import { describe, it, expect } from 'vitest';
import { ModelRegistry, ModelDescriptor, ModelError } from '../src/index.js';

describe('JAGGU ModelRegistry (M7-A)', () => {
  it('should initialize with built-in cloud and local models', () => {
    const registry = new ModelRegistry();
    const models = registry.listModels();

    expect(models.length).toBeGreaterThanOrEqual(10);
    expect(registry.hasModel('gpt-4o')).toBe(true);
    expect(registry.hasModel('claude-3-5-sonnet-latest')).toBe(true);
    expect(registry.hasModel('gemini-1.5-pro')).toBe(true);
    expect(registry.hasModel('qwen2.5-coder:7b')).toBe(true);
    expect(registry.hasModel('local-openai-default')).toBe(true);
    expect(registry.hasModel('mock-fast')).toBe(true);
  });

  it('should retrieve a model by ID and report accurate capabilities', () => {
    const registry = new ModelRegistry();
    const qwen = registry.getModel('qwen2.5-coder:7b');

    expect(qwen.displayName).toBe('Qwen 2.5 Coder 7B (Ollama)');
    expect(qwen.providerId).toBe('ollama');
    expect(qwen.runtimeType).toBe('local');
    expect(qwen.capabilities.streaming).toBe(true);
    expect(qwen.capabilities.toolCalling).toBe(true);
    expect(qwen.contextWindow).toBe(32768);
    expect(qwen.huggingFaceModelId).toBe('Qwen/Qwen2.5-Coder-7B-Instruct');
  });

  it('should distinguish reasoning models with toolCalling=false', () => {
    const registry = new ModelRegistry();
    const deepseek = registry.getModel('deepseek-r1:8b');

    expect(deepseek.capabilities.toolCalling).toBe(false);
    expect(deepseek.capabilities.structuredOutput).toBe(false);
  });

  it('should throw ModelError when requesting an unregistered model ID', () => {
    const registry = new ModelRegistry();
    expect(() => registry.getModel('non-existent-model')).toThrowError(ModelError);
    expect(() => registry.getModel('non-existent-model')).toThrowError(
      /is not registered in JAGGU ModelRegistry/,
    );
  });

  it('should filter models by provider and runtime type', () => {
    const registry = new ModelRegistry();
    const ollamaModels = registry.listByProvider('ollama');
    expect(ollamaModels.length).toBeGreaterThanOrEqual(3);
    expect(ollamaModels.every((m) => m.providerId === 'ollama')).toBe(true);

    const localModels = registry.listByRuntime('local');
    expect(localModels.length).toBeGreaterThanOrEqual(5);
    expect(localModels.every((m) => m.runtimeType === 'local')).toBe(true);

    const cloudModels = registry.listByRuntime('cloud');
    expect(cloudModels.length).toBeGreaterThanOrEqual(5);
    expect(cloudModels.every((m) => m.runtimeType === 'cloud')).toBe(true);
  });

  it('should register custom models with strict Zod validation', () => {
    const registry = new ModelRegistry([]);
    const customDescriptor: ModelDescriptor = {
      id: 'custom-local-mistral',
      displayName: 'Mistral 7B Local',
      providerId: 'ollama',
      runtimeType: 'local',
      contextWindow: 32768,
      maxOutputTokens: 4096,
      capabilities: {
        streaming: true,
        toolCalling: true,
        structuredOutput: true,
        vision: false,
      },
      health: 'available',
      huggingFaceModelId: 'mistralai/Mistral-7B-Instruct-v0.3',
    };

    registry.registerModel(customDescriptor);
    expect(registry.hasModel('custom-local-mistral')).toBe(true);
    expect(registry.getModel('custom-local-mistral').displayName).toBe('Mistral 7B Local');
  });

  it('should reject invalid model descriptors failing Zod schema', () => {
    const registry = new ModelRegistry([]);
    const invalidDescriptor = {
      id: '', // Invalid empty ID
      displayName: 'Invalid Model',
      providerId: 'ollama',
      runtimeType: 'unknown_type', // Invalid enum
      contextWindow: -100, // Invalid negative tokens
    };

    expect(() => registry.registerModel(invalidDescriptor as unknown as ModelDescriptor)).toThrow();
  });

  it('should update health status of a model', () => {
    const registry = new ModelRegistry();
    registry.updateModelHealth('qwen2.5-coder:7b', 'available', 'Endpoint reachable');
    const updated = registry.getModel('qwen2.5-coder:7b');

    expect(updated.health).toBe('available');
    expect(updated.healthDetail).toBe('Endpoint reachable');

    registry.updateModelHealth('qwen2.5-coder:7b', 'unreachable', 'ECONNREFUSED 127.0.0.1:11434');
    expect(registry.getModel('qwen2.5-coder:7b').health).toBe('unreachable');
  });

  it('should unregister a model', () => {
    const registry = new ModelRegistry();
    expect(registry.hasModel('gpt-4o')).toBe(true);
    expect(registry.unregisterModel('gpt-4o')).toBe(true);
    expect(registry.hasModel('gpt-4o')).toBe(false);
    expect(registry.findModel('gpt-4o')).toBeUndefined();
  });
});
