import http, { IncomingMessage, ServerResponse } from 'http';
import { ModelGateway, ModelRegistry, ModelDescriptor } from '@jaggu/core';
import { loadConfig, ServerConfig } from './config.js';
import { ProviderRouter } from './router.js';
import { handleChatCompletions } from './handlers/chatHandler.js';
import { formatOpenAIError } from './types/schema.js';

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB DoS protection limit

export class JagguProxyServer {
  private server: http.Server | null = null;
  private readonly config: ServerConfig;
  private readonly gateway: ModelGateway;
  private readonly registry: ModelRegistry;
  private readonly router: ProviderRouter;
  private readonly startTime: number = Date.now();

  constructor(config?: ServerConfig) {
    this.config = config || loadConfig();
    this.registry = new ModelRegistry();
    this.gateway = new ModelGateway(this.registry);
    this.router = new ProviderRouter(this.registry, this.config);
  }

  public getModelGateway(): ModelGateway {
    return this.gateway;
  }

  public getModelRegistry(): ModelRegistry {
    return this.registry;
  }

  public start(): Promise<{ port: number; host: string }> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        resolve({ port: this.config.port, host: this.config.host });
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
    });
  }

  private setSecurityAndCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    this.setSecurityAndCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Public health probes (liveness / readiness check for k8s/monitoring)
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
      this.handleHealth(req, res);
      return;
    }

    // Enforce Bearer Authentication on API routes if serverAuthSecret is set
    if (this.config.serverAuthSecret) {
      const authHeader = req.headers.authorization;
      const expected = `Bearer ${this.config.serverAuthSecret}`;
      if (authHeader !== expected) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            formatOpenAIError(
              'Unauthorized: Missing or invalid Bearer token',
              'authentication_error',
              'invalid_api_key',
            ),
          ),
        );
        return;
      }
    }

    if (req.method === 'GET' && pathname === '/v1/models') {
      this.handleListModels(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/v1/chat/completions') {
      this.readBodyAndDispatch(req, res, (body) => {
        handleChatCompletions(req, res, body, this.gateway, this.router);
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        formatOpenAIError(
          `Resource not found: ${req.method} ${pathname}`,
          'invalid_request_error',
          'not_found',
        ),
      ),
    );
  }

  private readBodyAndDispatch(
    req: IncomingMessage,
    res: ServerResponse,
    handler: (body: string) => void,
  ): void {
    let body = '';
    let bytesReceived = 0;

    req.on('data', (chunk: Buffer) => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_BODY_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            formatOpenAIError(
              'Payload too large: Request body exceeds 10MB limit',
              'invalid_request_error',
              'payload_too_large',
            ),
          ),
        );
        req.destroy();
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      handler(body);
    });
  }

  private handleHealth(_req: IncomingMessage, res: ServerResponse): void {
    const memory = process.memoryUsage();
    const providers = {
      huggingface: Boolean(this.config.keys.huggingface),
      openai: Boolean(this.config.keys.openai),
      anthropic: Boolean(this.config.keys.anthropic),
      gemini: Boolean(this.config.keys.gemini),
      ollama: Boolean(this.config.ollamaBaseUrl),
      mock: true,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        version: '0.1.0',
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        defaultProvider: this.config.defaultProvider,
        memoryUsageMb: {
          rss: Math.round(memory.rss / (1024 * 1024)),
          heapUsed: Math.round(memory.heapUsed / (1024 * 1024)),
        },
        providers,
        configuredProviders: providers,
      }),
    );
  }

  private handleListModels(_req: IncomingMessage, res: ServerResponse): void {
    const models = this.registry.listModels();
    const data = models.map((m: ModelDescriptor) => ({
      id: m.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: m.providerId,
      permission: [],
      root: m.id,
      parent: null,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data }));
  }
}
