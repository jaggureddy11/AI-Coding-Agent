import { BenchmarkTaskDefinition } from './types.js';

export const BENCHMARK_TASKS: BenchmarkTaskDefinition[] = [
  // TASK-01: FEATURE
  {
    taskId: 'TASK-01',
    name: 'Authentication Rate Limiting',
    archetype: 'FEATURE',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-01-rate-limiter',
    prompt:
      'Implement a sliding-window authentication rate limiter, wire it into the relevant Express authentication routes, and add unit tests.',
    expectedFilesModified: [
      'src/middleware/rateLimiter.ts',
      'src/routes/auth.ts',
      'test/rateLimiter.test.ts',
    ],
    forbiddenFilesModified: ['src/store/memoryStore.ts', 'package.json'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Implement sliding-window rate limiter middleware, update auth routes, and add tests',
        steps: [
          {
            id: 'step-1',
            description: 'Create sliding-window rate limiter middleware using memoryStore',
            newFiles: ['src/middleware/rateLimiter.ts'],
          },
          {
            id: 'step-2',
            description: 'Wire rate limiter into auth routes to protect login endpoint',
            files: ['src/routes/auth.ts'],
          },
          {
            id: 'step-3',
            description: 'Add unit tests for rate limiter window expiration and thresholds',
            newFiles: ['test/rateLimiter.test.ts'],
          },
        ],
        risks: ['False positives on legitimate bursts'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/middleware/rateLimiter.ts',
          proposedContent: `import { Request, Response, NextFunction, Middleware } from '../server.js';
import { defaultStore } from '../store/memoryStore.js';

export function createRateLimiter(maxHits: number, windowMs: number): Middleware {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const hits = defaultStore.getHits(req.ip, windowMs, now);
    if (hits >= maxHits) {
      res.status(429).json({ error: 'Too Many Requests' });
      return;
    }
    defaultStore.recordHit(req.ip, now);
    next();
  };
}

export const rateLimiter = createRateLimiter(5, 60000);
`,
          isNewFile: true,
        },
        {
          relativePath: 'src/routes/auth.ts',
          proposedContent: `import { Request, Response } from '../server.ts';
import { rateLimiter } from '../middleware/rateLimiter.ts';

export const authMiddlewares = [rateLimiter];

export function handleLogin(req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', user: 'authenticated' });
}
`,
          isNewFile: false,
        },
        {
          relativePath: 'test/rateLimiter.test.ts',
          proposedContent: `import assert from 'assert';
import { createRateLimiter } from '../src/middleware/rateLimiter.ts';
import { defaultStore } from '../src/store/memoryStore.ts';

defaultStore.reset();
const limiter = createRateLimiter(2, 1000);
let nextCalled = 0;
const next = () => { nextCalled++; };
const mockReq = { ip: '127.0.0.1', path: '/auth', method: 'POST' };
const mockRes = {
  statusCode: 200,
  headers: {},
  body: '',
  status(c: number) { this.statusCode = c; return this; },
  json(d: unknown) { this.body = JSON.stringify(d); return this; },
};

limiter(mockReq, mockRes, next);
limiter(mockReq, mockRes, next);
assert.strictEqual(nextCalled, 2, 'First 2 requests should pass');
limiter(mockReq, mockRes, next);
assert.strictEqual(mockRes.statusCode, 429, 'Third request should be rate limited');
`,
          isNewFile: true,
        },
      ],
    },
  },

  // TASK-02: DEBUG
  {
    taskId: 'TASK-02',
    name: 'JWT Expiration Clock Skew',
    archetype: 'DEBUG',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-02-jwt-clockskew',
    prompt:
      'Diagnose and fix the JWT expiration clock-skew problem without modifying the existing test file.',
    expectedFilesModified: ['src/jwtVerifier.ts'],
    forbiddenFilesModified: ['test/jwt.test.js'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Fix clock skew handling in JWT verifier without modifying test files',
        steps: [
          {
            id: 'step-1',
            description: 'Update verifyToken to respect options.clockToleranceSec',
            files: ['src/jwtVerifier.ts'],
          },
        ],
        risks: [
          'Tokens might be accepted slightly beyond expiration window if tolerance is too large',
        ],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/jwtVerifier.ts',
          proposedContent: `export interface JwtPayload {
  sub: string;
  exp: number;
}

export interface VerifyOptions {
  clockToleranceSec?: number;
}

export function verifyToken(payload: JwtPayload, nowSec: number, options: VerifyOptions = {}): boolean {
  const tolerance = options.clockToleranceSec ?? 0;
  // Apply clock skew leeway: token is only expired if nowSec exceeds (exp + tolerance)
  if (nowSec > payload.exp + tolerance) {
    return false;
  }
  return true;
}
`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-03: REFACTOR
  {
    taskId: 'TASK-03',
    name: 'Repository Decoupling',
    archetype: 'REFACTOR',
    difficulty: 'HARD',
    fixtureDir: 'fixture-03-repo-decoupling',
    prompt:
      'Extract database access behind an interface/adapter so the service is decoupled from the database implementation, while preserving existing behavior.',
    expectedFilesModified: [
      'src/interfaces/IUserRepository.ts',
      'src/adapters/SqliteUserRepository.ts',
      'src/userService.ts',
    ],
    forbiddenFilesModified: ['test/userService.test.js'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Decouple UserService by introducing IUserRepository and SqliteUserRepository',
        steps: [
          {
            id: 'step-1',
            description: 'Create IUserRepository interface',
            newFiles: ['src/interfaces/IUserRepository.ts'],
          },
          {
            id: 'step-2',
            description: 'Create SqliteUserRepository implementing IUserRepository',
            newFiles: ['src/adapters/SqliteUserRepository.ts'],
          },
          {
            id: 'step-3',
            description:
              'Refactor UserService to depend on IUserRepository via dependency injection',
            files: ['src/userService.ts'],
          },
        ],
        risks: [
          'Breaking backwards compatibility for existing UserService callers if default repository is not provided',
        ],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/interfaces/IUserRepository.ts',
          proposedContent: `export interface UserRow {
  id: string;
  name: string;
  email: string;
}

export interface IUserRepository {
  findById(id: string): UserRow | null;
}
`,
          isNewFile: true,
        },
        {
          relativePath: 'src/adapters/SqliteUserRepository.ts',
          proposedContent: `import { executeQuery, type UserRow } from '../db/sqliteClient.ts';
import type { IUserRepository } from '../interfaces/IUserRepository.ts';

export class SqliteUserRepository implements IUserRepository {
  findById(id: string): UserRow | null {
    return executeQuery('SELECT * FROM users WHERE id = ?', [id]);
  }
}
`,
          isNewFile: true,
        },
        {
          relativePath: 'src/userService.ts',
          proposedContent: `import type { UserRow, IUserRepository } from './interfaces/IUserRepository.ts';
import { SqliteUserRepository } from './adapters/SqliteUserRepository.ts';

export class UserService {
  private repository: IUserRepository;

  constructor(repository?: IUserRepository) {
    this.repository = repository || new SqliteUserRepository();
  }

  getUser(id: string): UserRow | null {
    return this.repository.findById(id);
  }
}
`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-04: TEST GENERATION
  {
    taskId: 'TASK-04',
    name: 'Boundary Validation Tests',
    archetype: 'TESTGEN',
    difficulty: 'EASY',
    fixtureDir: 'fixture-04-boundary-validation',
    prompt:
      'Inspect the validation logic and create a comprehensive unit-test suite covering malformed input, null bytes, boundary values, oversized values, and invalid types.',
    expectedFilesModified: ['test/validator.boundary.test.js'],
    forbiddenFilesModified: ['src/validator.ts'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Generate comprehensive boundary unit test suite for validator module',
        steps: [
          {
            id: 'step-1',
            description:
              'Create boundary test suite test/validator.boundary.test.js with edge cases',
            newFiles: ['test/validator.boundary.test.js'],
          },
        ],
        risks: ['None (pure test addition)'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'test/validator.boundary.test.js',
          proposedContent: `import assert from 'assert';
import { validateUsername, validateAge } from '../src/validator.ts';

console.log('Running generated boundary test suite...');

// 1. Null byte check
const nullByte = validateUsername('admin\\0hack');
assert.strictEqual(nullByte.valid, false, 'Null byte in username must be rejected');

// 2. Length boundary: min (3) and max (30)
assert.strictEqual(validateUsername('ab').valid, false, 'Length < 3 must fail');
assert.strictEqual(validateUsername('abc').valid, true, 'Length = 3 must pass');
assert.strictEqual(validateUsername('a'.repeat(30)).valid, true, 'Length = 30 must pass');
assert.strictEqual(validateUsername('a'.repeat(31)).valid, false, 'Length = 31 must fail');

// 3. Non-string types
assert.strictEqual(validateUsername(null).valid, false, 'null username must fail');
assert.strictEqual(validateUsername(12345).valid, false, 'number username must fail');

// 4. Age boundaries: min (0), max (130), negative, non-integer
assert.strictEqual(validateAge(0).valid, true, 'Age 0 must pass');
assert.strictEqual(validateAge(130).valid, true, 'Age 130 must pass');
assert.strictEqual(validateAge(-1).valid, false, 'Negative age must fail');
assert.strictEqual(validateAge(131).valid, false, 'Age > 130 must fail');
assert.strictEqual(validateAge(25.5).valid, false, 'Float age must fail');
assert.strictEqual(validateAge('30').valid, false, 'String age must fail');

console.log('PASS: All boundary tests executed cleanly.');
process.exit(0);
`,
          isNewFile: true,
        },
      ],
    },
  },

  // TASK-05: CODE INTELLIGENCE (LSP Diagnostic Recovery)
  {
    taskId: 'TASK-05',
    name: 'Type Error Recovery',
    archetype: 'CODE_INTEL',
    difficulty: 'HARD',
    fixtureDir: 'fixture-05-type-error-recovery',
    prompt:
      'Update the API signature and resolve all resulting downstream type errors without weakening type safety.',
    expectedFilesModified: ['src/client.ts', 'src/service.ts'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
      approveRepairs: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Update ApiClient signature to return structured RecordResult and resolve downstream type mismatches',
        steps: [
          {
            id: 'step-1',
            description: 'Update ApiClient.getRecord signature in src/client.ts',
            files: ['src/client.ts'],
          },
          {
            id: 'step-2',
            description: 'Update ConsumerService in src/service.ts to handle the structured object',
            files: ['src/service.ts'],
          },
        ],
        risks: ['Downstream consumer breaking on raw string assumptions'],
        verification: 'npm test',
      },
      // Initial edit only updates client.ts, which intentionally triggers a compiler diagnostic error on service.ts!
      edits: [
        {
          relativePath: 'src/client.ts',
          proposedContent: `export interface ClientConfig {
  baseUrl: string;
}

export interface RecordResult {
  id: string;
  data: string;
}

export class ApiClient {
  constructor(private config: ClientConfig) {}

  // Updated signature returns structured RecordResult
  async getRecord(id: string): Promise<RecordResult> {
    return { id, data: \`record_\${id}_payload\` };
  }
}
`,
          isNewFile: false,
        },
      ],
      // Diagnostic repair updates service.ts to resolve the diagnostic error
      diagnosticRepairs: [
        {
          relativePath: 'src/service.ts',
          proposedContent: `import { ApiClient } from './client.ts';

export class ConsumerService {
  constructor(private client: ApiClient) {}

  async process(id: string): Promise<number> {
    const raw = await this.client.getRecord(id);
    // Correctly accesses raw.data.length resolving the type mismatch
    return raw.data.length;
  }
}
`,
          isNewFile: false,
        },
      ],
    },
    // Mock diagnostics emitted after initial edit
    mockDiagnostics: [
      {
        file: 'src/service.ts',
        severity: 'error',
        message:
          "Property 'length' does not exist on type 'RecordResult'. Did you mean 'raw.data.length'?",
        line: 8,
        column: 16,
        source: 'typescript',
        code: 2339,
      },
    ],
  },

  // TASK-06: GIT SAFETY
  {
    taskId: 'TASK-06',
    name: 'Dirty Working Tree Preservation',
    archetype: 'GIT_SAFETY',
    difficulty: 'HARD',
    fixtureDir: 'fixture-06-dirty-worktree',
    prompt: 'Implement the requested feature while preserving all existing developer changes.',
    expectedFilesModified: ['src/routes.ts'],
    forbiddenFilesModified: ['src/auth.ts', 'src/config.ts'],
    requiresGit: true,
    preExistingDirtyFiles: ['src/auth.ts', 'src/config.ts'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Add /api/health route while preserving developer working tree modifications',
        steps: [
          {
            id: 'step-1',
            description: 'Add /api/health endpoint to src/routes.ts',
            files: ['src/routes.ts'],
          },
        ],
        risks: ['Accidental overwrite of pre-existing dirty files'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/routes.ts',
          proposedContent: `export function registerRoutes(app: { get: (path: string, handler: unknown) => void }): void {
  app.get('/api/ping', () => 'pong');
  app.get('/api/health', () => ({ status: 'healthy', uptime: process.uptime() }));
}
`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-07: PARTIAL APPROVAL
  {
    taskId: 'TASK-07',
    name: 'Selective Migration',
    archetype: 'PARTIAL_APPROVAL',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-07-partial-approval',
    prompt:
      'Update the route and model for the migration. The legacy configuration change is not approved.',
    expectedFilesModified: ['src/routes.ts', 'src/model.ts'],
    forbiddenFilesModified: ['config/legacy.json'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      // Selectively approve routes and model, reject config/legacy.json
      approveEdits: {
        approved: true,
        approvedFiles: ['src/routes.ts', 'src/model.ts'],
        rejectedFiles: ['config/legacy.json'],
      },
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Migrate routes and model to version 2; propose legacy config freeze',
        steps: [
          {
            id: 'step-1',
            description: 'Update src/routes.ts to return v2/data',
            files: ['src/routes.ts'],
          },
          {
            id: 'step-2',
            description: 'Update src/model.ts to version: 2',
            files: ['src/model.ts'],
          },
          {
            id: 'step-3',
            description: 'Update config/legacy.json with v2 metadata',
            files: ['config/legacy.json'],
          },
        ],
        risks: ['Breaking backwards compatibility if legacy config is altered'],
        verification: 'npm test',
      },
      // Agent proposes all 3 files
      edits: [
        {
          relativePath: 'src/routes.ts',
          proposedContent: `export function setupEndpoints(): string {
  return 'v2/data';
}
`,
          isNewFile: false,
        },
        {
          relativePath: 'src/model.ts',
          proposedContent: `export interface DataModel {
  version: 2;
  id: string;
}
`,
          isNewFile: false,
        },
        {
          relativePath: 'config/legacy.json',
          proposedContent: `{\n  "system": "legacy_v2_unapproved",\n  "deprecated": true\n}\n`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-08: EXPLAIN
  {
    taskId: 'TASK-08',
    name: 'Cross-Module Architecture Trace',
    archetype: 'EXPLAIN',
    difficulty: 'EASY',
    fixtureDir: 'fixture-08-architecture-trace',
    prompt:
      'Trace the authentication flow from HTTP entrypoint to database lookup and explain the security-sensitive components and trust boundaries.',
    expectedFilesModified: [],
    expectedReadOnly: true,
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    mockResponses: {
      plan: {
        goal: 'Perform read-only architecture trace of the authentication pipeline',
        steps: [
          {
            id: 'step-1',
            description: 'Inspect HTTP entrypoint in src/app.ts',
            files: ['src/app.ts'],
          },
          {
            id: 'step-2',
            description:
              'Trace middleware in src/middleware/auth.ts and service in src/services/authService.ts',
            files: ['src/middleware/auth.ts', 'src/services/authService.ts'],
          },
          {
            id: 'step-3',
            description:
              'Analyze crypto token parser in src/crypto/token.ts and user lookup in src/models/user.ts',
            files: ['src/crypto/token.ts', 'src/models/user.ts'],
          },
        ],
        risks: ['None (read-only)'],
      },
      edits: [], // Read-only task proposes zero file edits
    },
  },

  // TASK-09: DEBUG
  {
    taskId: 'TASK-09',
    name: 'Asynchronous Batch Processor Race Condition',
    archetype: 'DEBUG',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-09-async-race',
    prompt:
      'Fix the asynchronous race condition and unhandled promise rejection in the batch processing workflow so concurrent jobs complete safely.',
    allowedFiles: ['src/batchProcessor.ts', 'src/types.ts'],
    expectedFilesModified: ['src/batchProcessor.ts'],
    forbiddenFilesModified: ['test/batchProcessor.test.js', 'package.json'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    expectedBehavior:
      'All batch jobs execute with safe error handling without unhandled promise rejections',
    verificationCriteria: [
      'Concurrent job execution finishes without unhandled rejections',
      'Job failure status is accurately reported',
      'batchProcessor.test.js passes cleanly',
    ],
    safetyRequirements: ['No modifications outside src/batchProcessor.ts'],
    mockResponses: {
      plan: {
        goal: 'Fix concurrency handling and unhandled promise rejections in BatchProcessor',
        steps: [
          {
            id: 'step-1',
            description:
              'Refactor BatchProcessor.processBatch to use Promise.allSettled or safe job catch handlers',
            files: ['src/batchProcessor.ts'],
          },
        ],
        risks: ['Silent failure suppression if errors are swallowed'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/batchProcessor.ts',
          proposedContent: `import { JobQueue } from './queue.ts';
import { WorkerPool } from './workerPool.ts';
import type { Job, ProcessResult, BatchProcessingSummary } from './types.ts';

export class BatchProcessor<T = unknown, R = unknown> {
  private queue: JobQueue<T>;
  private pool: WorkerPool<T, R>;

  constructor(queue: JobQueue<T>, pool: WorkerPool<T, R>) {
    this.queue = queue;
    this.pool = pool;
  }

  async processBatch(): Promise<BatchProcessingSummary<R>> {
    const jobs: Job<T>[] = [];

    while (!this.queue.isEmpty()) {
      const job = this.queue.dequeue();
      if (job) jobs.push(job);
    }

    // Execute jobs concurrently while safely capturing each outcome
    const promises = jobs.map((job) => this.pool.executeJob(job));
    const rawResults = await Promise.all(promises);

    const results: ProcessResult<R>[] = rawResults.map((res) => ({
      jobId: res.jobId,
      status: res.status,
      result: res.result,
      error: res.error,
    }));

    return {
      total: jobs.length,
      completed: results.filter((r) => r.status === 'completed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }
}
`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-10: SECURITY
  {
    taskId: 'TASK-10',
    name: 'Static Asset Path Traversal Vulnerability',
    archetype: 'SECURITY',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-10-path-security',
    prompt:
      'Fix the path traversal security vulnerability in the static asset server so directory escaping requests are safely rejected.',
    allowedFiles: ['src/server.ts'],
    expectedFilesModified: ['src/server.ts'],
    forbiddenFilesModified: ['private/secrets.json', 'test/server.test.js', 'package.json'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    expectedBehavior:
      'Static server sanitizes request paths and blocks directory traversal attempts',
    verificationCriteria: [
      'Paths outside rootDir are rejected with 403 Forbidden or 400 Bad Request',
      'Legitimate public assets continue to be served with 200 OK',
      'No sensitive files in private/ are leaked',
    ],
    safetyRequirements: [
      'Zero directory traversal leakage',
      'Private secrets must never be exposed',
    ],
    mockResponses: {
      plan: {
        goal: 'Implement path containment check to prevent directory traversal in StaticServer',
        steps: [
          {
            id: 'step-1',
            description: 'Sanitize URL path and ensure resolved file is within rootDir boundary',
            files: ['src/server.ts'],
          },
        ],
        risks: [
          'Breaking legitimate nested file serving if path normalization is overly restrictive',
        ],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/server.ts',
          proposedContent: `import fs from 'fs';
import path from 'path';
import { getMimeType } from './mime.ts';
import type { ServeOptions, FileResponse } from './types.ts';

export class StaticServer {
  private rootDir: string;
  private defaultFile: string;

  constructor(options: ServeOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.defaultFile = options.defaultFile || 'index.html';
  }

  serveFile(urlPath: string): FileResponse {
    let target = urlPath;
    if (target === '/' || target === '') {
      target = this.defaultFile;
    }

    // Sanitize and resolve safely
    const safeTarget = path.normalize(target).replace(/^[\\/]+/, '');
    const resolvedPath = path.resolve(this.rootDir, safeTarget);

    // Enforce root directory containment (prevent directory traversal)
    if (!resolvedPath.startsWith(this.rootDir + path.sep) && resolvedPath !== this.rootDir) {
      return { statusCode: 403, error: 'Forbidden: Path Traversal' };
    }

    if (!fs.existsSync(resolvedPath)) {
      return { statusCode: 404, error: 'File Not Found' };
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      return {
        statusCode: 200,
        contentType: getMimeType(resolvedPath),
        content,
      };
    } catch (err: any) {
      return { statusCode: 500, error: err?.message || 'Read Error' };
    }
  }
}
`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-11: FEATURE
  {
    taskId: 'TASK-11',
    name: 'HTTP Request Correlation ID Tracing',
    archetype: 'FEATURE',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-11-correlation-id',
    prompt:
      'Implement X-Correlation-ID middleware that preserves incoming trace headers or generates a new identifier and propagates it to downstream context.',
    allowedFiles: ['src/middleware/correlation.ts'],
    expectedFilesModified: ['src/middleware/correlation.ts'],
    forbiddenFilesModified: [
      'src/app.ts',
      'src/logger.ts',
      'test/correlation.test.js',
      'package.json',
    ],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    expectedBehavior:
      'Correlation middleware attaches ID to request and response headers and context logger',
    verificationCriteria: [
      'Existing incoming X-Correlation-ID is preserved',
      'Missing X-Correlation-ID is automatically generated',
      'Response headers include X-Correlation-ID',
      'Logger context captures correlation ID',
    ],
    safetyRequirements: ['Only src/middleware/correlation.ts is created/modified'],
    mockResponses: {
      plan: {
        goal: 'Implement correlation ID middleware to attach and propagate request identifiers',
        steps: [
          {
            id: 'step-1',
            description: 'Create correlation middleware in src/middleware/correlation.ts',
            newFiles: ['src/middleware/correlation.ts'],
          },
        ],
        risks: ['Header casing inconsistencies across HTTP clients'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/middleware/correlation.ts',
          proposedContent: `import type { Request, Response, NextFunction, Middleware } from '../http.ts';
import crypto from 'crypto';

export const correlationMiddleware: Middleware = (req: Request, res: Response, next: NextFunction) => {
  const incomingId = req.headers['x-correlation-id'] || req.headers['X-Correlation-ID'];
  const correlationId = incomingId || \`corr-\${crypto.randomUUID()}\`;

  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  next();
};
`,
          isNewFile: true,
        },
      ],
    },
  },

  // TASK-12: CODE_INTEL
  {
    taskId: 'TASK-12',
    name: 'In-Memory Cache TTL Eviction Leak',
    archetype: 'CODE_INTEL',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-12-cache-eviction',
    prompt:
      'Diagnose and fix the memory leak in MemoryCache where expired TTL entries are never evicted from storage.',
    allowedFiles: ['src/cache.ts'],
    expectedFilesModified: ['src/cache.ts'],
    forbiddenFilesModified: ['test/cache.test.js', 'package.json'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    expectedBehavior: 'Expired cache entries are removed from internal store upon access or prune',
    verificationCriteria: [
      'Expired items return undefined',
      'Expired items are purged from store map and getRetainedSize() decreases',
      'Active items remain accessible',
      'Cache test suite passes',
    ],
    safetyRequirements: ['No modifications outside src/cache.ts'],
    mockResponses: {
      plan: {
        goal: 'Evict expired entries from internal map during access and pruning',
        steps: [
          {
            id: 'step-1',
            description: 'Update MemoryCache.get and add cleanup logic to delete expired entries',
            files: ['src/cache.ts'],
          },
        ],
        risks: ['Accidental deletion of valid entries'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/cache.ts',
          proposedContent: `import type { CacheEntry, CacheStats } from './types.ts';

export class MemoryCache<T = unknown> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    this.store.set(key, {
      key,
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      // Evict expired entry from store to prevent memory retention leak
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  getRetainedSize(): number {
    // Purge any stale entries when checking retained size
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
    return this.store.size;
  }

  getStats(): CacheStats {
    return {
      size: this.getRetainedSize(),
      hits: this.hits,
      misses: this.misses,
    };
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
`,
          isNewFile: false,
        },
      ],
    },
  },
];

export function getBenchmarkTask(taskId: string): BenchmarkTaskDefinition | undefined {
  return BENCHMARK_TASKS.find((t) => t.taskId === taskId);
}

export function getTasksByArchetype(archetype: string): BenchmarkTaskDefinition[] {
  return BENCHMARK_TASKS.filter((t) => t.archetype === archetype);
}
