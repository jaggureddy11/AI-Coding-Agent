import {
  ModelDescriptor,
  ModelDescriptorSchema,
  ModelHealthStatus,
  ModelRuntimeType,
} from '../types/modelRegistry.js';
import { ModelError } from '../types/models.js';

export const DEFAULT_BUILTIN_MODELS: ModelDescriptor[] = [
  // --- Cloud: Hugging Face Inference (Free & Open Priority) ---
  {
    id: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
    displayName: 'Qwen 3 Coder 30B (Hugging Face Free)',
    providerId: 'huggingface',
    runtimeType: 'cloud',
    modelFamily: 'qwen3-coder',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
      coding: 95,
      reasoning: 92,
    },
    access: 'free',
    availability: 'available',
    health: 'unknown',
    hfModelId: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
    huggingFaceModelId: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
  },
  {
    id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    displayName: 'Qwen 2.5 Coder 32B (Hugging Face)',
    providerId: 'huggingface',
    runtimeType: 'cloud',
    modelFamily: 'qwen2.5-coder',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
      coding: 91,
      reasoning: 87,
    },
    access: 'free',
    availability: 'available',
    health: 'unknown',
    hfModelId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    huggingFaceModelId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
  },
  {
    id: 'meta-llama/Llama-3.1-8B-Instruct',
    displayName: 'Llama 3.1 8B Instruct (Hugging Face)',
    providerId: 'huggingface',
    runtimeType: 'cloud',
    modelFamily: 'llama-3.1',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
      coding: 78,
      reasoning: 76,
    },
    access: 'free',
    availability: 'available',
    health: 'unknown',
    hfModelId: 'meta-llama/Llama-3.1-8B-Instruct',
    huggingFaceModelId: 'meta-llama/Llama-3.1-8B-Instruct',
  },

  // --- Local: Ollama Coding Models ---
  {
    id: 'qwen2.5-coder:7b',
    displayName: 'Qwen 2.5 Coder 7B (Ollama)',
    providerId: 'ollama',
    runtimeType: 'local',
    modelFamily: 'qwen2.5-coder',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
      coding: 86,
      reasoning: 82,
    },
    access: 'local',
    availability: 'available',
    health: 'unknown',
    hfModelId: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    huggingFaceModelId: 'Qwen/Qwen2.5-Coder-7B-Instruct',
  },
  {
    id: 'deepseek-r1:8b',
    displayName: 'DeepSeek-R1 8B (Ollama)',
    providerId: 'ollama',
    runtimeType: 'local',
    modelFamily: 'deepseek-r1',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: false, // Reasoning model: chat/explanation only, no native tool calling
      structuredOutput: false,
      vision: false,
      coding: 80,
      reasoning: 90,
    },
    access: 'local',
    availability: 'available',
    health: 'unknown',
    hfModelId: 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
    huggingFaceModelId: 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
  },
  {
    id: 'llama3.3:70b',
    displayName: 'Llama 3.3 70B (Ollama)',
    providerId: 'ollama',
    runtimeType: 'local',
    modelFamily: 'llama-3.3',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
      coding: 90,
      reasoning: 89,
    },
    access: 'local',
    availability: 'available',
    health: 'unknown',
    hfModelId: 'meta-llama/Llama-3.3-70B-Instruct',
    huggingFaceModelId: 'meta-llama/Llama-3.3-70B-Instruct',
  },

  // --- Local: Generic OpenAI-Compatible Runtime (vLLM, LM Studio, etc.) ---
  {
    id: 'local-openai-default',
    displayName: 'Local Server (vLLM / LM Studio)',
    providerId: 'openai-compatible',
    runtimeType: 'local',
    modelFamily: 'local-generic',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
      coding: 82,
      reasoning: 80,
    },
    access: 'local',
    availability: 'available',
    health: 'unknown',
  },
  {
    id: 'deepseek-coder-v2',
    displayName: 'DeepSeek Coder V2 (Local vLLM)',
    providerId: 'openai-compatible',
    runtimeType: 'local',
    modelFamily: 'deepseek-coder-v2',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
      coding: 92,
      reasoning: 88,
    },
    access: 'local',
    availability: 'available',
    health: 'unknown',
    hfModelId: 'deepseek-ai/DeepSeek-Coder-V2-Instruct',
    huggingFaceModelId: 'deepseek-ai/DeepSeek-Coder-V2-Instruct',
  },

  // --- Cloud: OpenAI (Configured Paid) ---
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o (Omni)',
    providerId: 'openai',
    runtimeType: 'cloud',
    modelFamily: 'gpt-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      coding: 94,
      reasoning: 92,
    },
    access: 'paid',
    availability: 'auth-required',
    health: 'unknown',
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    providerId: 'openai',
    runtimeType: 'cloud',
    modelFamily: 'gpt-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      coding: 85,
      reasoning: 84,
    },
    access: 'paid',
    availability: 'auth-required',
    health: 'unknown',
  },
  {
    id: 'o3-mini',
    displayName: 'o3-mini (Reasoning)',
    providerId: 'openai',
    runtimeType: 'cloud',
    modelFamily: 'o3-mini',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
      coding: 95,
      reasoning: 98,
    },
    access: 'paid',
    availability: 'auth-required',
    health: 'unknown',
  },

  // --- Cloud: Anthropic (Configured Paid) ---
  {
    id: 'claude-3-5-sonnet-latest',
    displayName: 'Claude 3.5 Sonnet',
    providerId: 'anthropic',
    runtimeType: 'cloud',
    modelFamily: 'claude-3.5',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      coding: 98,
      reasoning: 96,
    },
    access: 'paid',
    availability: 'auth-required',
    health: 'unknown',
  },
  {
    id: 'claude-3-5-haiku-latest',
    displayName: 'Claude 3.5 Haiku',
    providerId: 'anthropic',
    runtimeType: 'cloud',
    modelFamily: 'claude-3.5',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      coding: 88,
      reasoning: 86,
    },
    access: 'paid',
    availability: 'auth-required',
    health: 'unknown',
  },

  // --- Cloud: Gemini (Configured Paid) ---
  {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    providerId: 'gemini',
    runtimeType: 'cloud',
    modelFamily: 'gemini-1.5',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      coding: 91,
      reasoning: 90,
    },
    access: 'paid',
    availability: 'auth-required',
    health: 'unknown',
  },
  {
    id: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    providerId: 'gemini',
    runtimeType: 'cloud',
    modelFamily: 'gemini-1.5',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      coding: 84,
      reasoning: 82,
    },
    access: 'paid',
    availability: 'auth-required',
    health: 'unknown',
  },

  // --- Testing & Offline: Mock ---
  {
    id: 'mock-fast',
    displayName: 'JAGGU Mock (Deterministic)',
    providerId: 'mock',
    runtimeType: 'local',
    modelFamily: 'mock',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      vision: false,
      coding: 85,
      reasoning: 80,
    },
    access: 'free',
    availability: 'available',
    health: 'available',
  },
  {
    id: 'mock-reasoning',
    displayName: 'JAGGU Mock Reasoning (No Tools)',
    providerId: 'mock',
    runtimeType: 'local',
    modelFamily: 'mock',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    capabilities: {
      streaming: true,
      toolCalling: false,
      structuredOutput: false,
      vision: false,
      coding: 80,
      reasoning: 92,
    },
    access: 'free',
    availability: 'available',
    health: 'available',
  },
];

export class ModelRegistry {
  private readonly models = new Map<string, ModelDescriptor>();

  constructor(initialModels: ModelDescriptor[] = DEFAULT_BUILTIN_MODELS) {
    for (const model of initialModels) {
      this.registerModel(model);
    }
  }

  /**
   * Registers a new model descriptor with schema validation.
   */
  public registerModel(descriptor: ModelDescriptor): void {
    const validated = ModelDescriptorSchema.parse(descriptor);
    this.models.set(validated.id, validated);
  }

  /**
   * Retrieves a model descriptor by its stable ID.
   * Throws ModelError if not registered.
   */
  public getModel(id: string): ModelDescriptor {
    const found = this.models.get(id);
    if (!found) {
      throw new ModelError(
        `Model "${id}" is not registered in JAGGU ModelRegistry. Available models: ${Array.from(
          this.models.keys(),
        ).join(', ')}`,
        'MALFORMED_RESPONSE',
        'registry',
      );
    }
    return found;
  }

  public findModel(id: string): ModelDescriptor | undefined {
    return this.models.get(id);
  }

  public hasModel(id: string): boolean {
    return this.models.has(id);
  }

  public listModels(): ModelDescriptor[] {
    return Array.from(this.models.values());
  }

  public listByProvider(providerId: string): ModelDescriptor[] {
    return this.listModels().filter((m) => m.providerId === providerId);
  }

  public listByRuntime(type: ModelRuntimeType): ModelDescriptor[] {
    return this.listModels().filter((m) => m.runtimeType === type);
  }

  /**
   * Updates health status and details for an existing registered model.
   */
  public updateModelHealth(id: string, health: ModelHealthStatus, healthDetail?: string): void {
    const existing = this.models.get(id);
    if (existing) {
      this.models.set(id, {
        ...existing,
        health,
        healthDetail,
      });
    }
  }

  /**
   * Unregisters a model by ID.
   */
  public unregisterModel(id: string): boolean {
    return this.models.delete(id);
  }
}
