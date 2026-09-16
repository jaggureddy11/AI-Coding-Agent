import { ModelRegistry } from '@jaggu/core';
import { ServerConfig } from './config.js';

export interface ResolvedProvider {
  providerId: string;
  apiKey?: string;
  baseUrl?: string;
}

export class MissingBackendKeyError extends Error {
  public readonly providerId: string;
  constructor(providerId: string) {
    super(`Provider "${providerId}" API key is not configured on the backend server.`);
    this.name = 'MissingBackendKeyError';
    this.providerId = providerId;
  }
}

export class ProviderRouter {
  constructor(
    private readonly registry: ModelRegistry,
    private readonly config: ServerConfig,
  ) {}

  public resolve(modelId: string): ResolvedProvider {
    const registered = this.registry.findModel(modelId);
    let providerId = registered ? registered.providerId : this.config.defaultProvider;

    // Inference by model prefix / family if not registered explicitly
    if (!registered) {
      if (modelId.startsWith('gpt-') || modelId.startsWith('o1-') || modelId.startsWith('o3-')) {
        providerId = 'openai';
      } else if (modelId.startsWith('claude-')) {
        providerId = 'anthropic';
      } else if (modelId.startsWith('gemini-')) {
        providerId = 'gemini';
      } else if (
        modelId.includes('/') ||
        modelId.startsWith('meta-llama') ||
        modelId.startsWith('Qwen/')
      ) {
        providerId = 'huggingface';
      }
    }

    let apiKey: string | undefined;
    let baseUrl: string | undefined;

    switch (providerId) {
      case 'huggingface':
        apiKey = this.config.keys.huggingface;
        if (!apiKey) {
          throw new MissingBackendKeyError('huggingface');
        }
        break;
      case 'openai':
        apiKey = this.config.keys.openai;
        if (!apiKey) {
          throw new MissingBackendKeyError('openai');
        }
        break;
      case 'anthropic':
        apiKey = this.config.keys.anthropic;
        if (!apiKey) {
          throw new MissingBackendKeyError('anthropic');
        }
        break;
      case 'gemini':
        apiKey = this.config.keys.gemini;
        if (!apiKey) {
          throw new MissingBackendKeyError('gemini');
        }
        break;
      case 'ollama':
        baseUrl = this.config.ollamaBaseUrl;
        break;
      case 'mock':
        apiKey = 'mock-test-key';
        break;
      default:
        apiKey = this.config.keys.huggingface || this.config.keys.openai;
        if (!apiKey) {
          throw new MissingBackendKeyError(providerId);
        }
    }

    return { providerId, apiKey, baseUrl };
  }
}
