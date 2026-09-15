import { describe, it, expect, beforeEach } from 'vitest';
import {
  ModelRegistry,
  ModelRouter,
  TaskClassifier,
  EventBus,
  ModelError,
  ModelDescriptor,
} from '../src/index.js';

describe('JAGGU ModelRouter & TaskClassifier (Milestone: Multi-Model Gateway)', () => {
  let registry: ModelRegistry;
  let eventBus: EventBus;
  let router: ModelRouter;

  beforeEach(() => {
    registry = new ModelRegistry();
    eventBus = new EventBus();
    router = new ModelRouter(registry, eventBus, {
      policy: 'free-first',
      allowPaidFallbackInAuto: false,
      configuredProviderIds: [],
    });
  });

  describe('TaskClassifier', () => {
    it('should classify code mutation tasks and require tools', () => {
      const task = TaskClassifier.classify('Implement user registration endpoint in auth/userService.ts');
      expect(task.category).toBe('CODE_MUTATION');
      expect(task.requiresTools).toBe(true);
      expect(task.estimatedContextTokens).toBeGreaterThan(4000);
    });

    it('should classify bug fix tasks and allocate high coding weight', () => {
      const task = TaskClassifier.classify({
        prompt: 'Fix the JWT signature mismatch bug causing 401 error',
        activeFile: 'src/auth/jwt.ts',
        diagnosticsCount: 2,
      });
      expect(task.category).toBe('BUG_FIX');
      expect(task.requiresTools).toBe(true);
      expect(task.codingWeight).toBeGreaterThanOrEqual(0.8);
      expect(task.estimatedContextTokens).toBeGreaterThan(5000);
    });

    it('should classify pure explanation requests as EXPLANATION with tools disabled', () => {
      const task = TaskClassifier.classify('Explain how the EventBus works in this project');
      expect(task.category).toBe('EXPLANATION');
      expect(task.requiresTools).toBe(false);
    });

    it('should classify slash commands deterministically', () => {
      expect(TaskClassifier.classify('/explain how authentication works').category).toBe('EXPLANATION');
      expect(TaskClassifier.classify('/explain how authentication works').requiresTools).toBe(false);

      expect(TaskClassifier.classify('/test userService').category).toBe('TEST_GENERATION');
      expect(TaskClassifier.classify('/test userService').requiresTools).toBe(true);

      expect(TaskClassifier.classify('/fix null pointer in payment').category).toBe('BUG_FIX');
      expect(TaskClassifier.classify('/fix null pointer in payment').requiresTools).toBe(true);

      expect(TaskClassifier.classify('/refactor database connection pool').category).toBe('REFACTOR');
      expect(TaskClassifier.classify('/refactor database connection pool').requiresTools).toBe(true);

      expect(TaskClassifier.classify('/search token validation').category).toBe('SEARCH');
      expect(TaskClassifier.classify('/search token validation').requiresTools).toBe(true);
    });
  });

  describe('Candidate Filtering & Auto Routing', () => {
    it('should select Qwen 3 Coder 30B as default primary free model for code mutation', () => {
      const result = router.route('Write an express middleware for rate limiting');
      expect(result.selectedModel.id).toBe('Qwen/Qwen3-Coder-30B-A3B-Instruct');
      expect(result.selectedModel.access).toBe('free');
      expect(result.providerId).toBe('huggingface');
      expect(result.attempt).toBe(0);
      expect(result.fallbackCandidates.length).toBeGreaterThan(0);
    });

    it('should reject models lacking tool calling when the task requires tools', () => {
      // deepseek-r1:8b has toolCalling: false
      const result = router.route('Refactor the database migrations');
      expect(result.selectedModel.capabilities.toolCalling).toBe(true);
      // Ensure deepseek-r1 was not selected as primary or fallback candidate
      const candidateIds = [result.selectedModel.id, ...result.fallbackCandidates.map((c) => c.id)];
      expect(candidateIds).not.toContain('deepseek-r1:8b');
    });

    it('should allow reasoning models with toolCalling=false for explanation tasks', () => {
      const result = router.route('/explain how the consensus algorithm works');
      expect(result.taskClassification.requiresTools).toBe(false);
      // Models without tool calling should not be filtered out
      const allIds = [result.selectedModel.id, ...result.fallbackCandidates.map((c) => c.id)];
      expect(allIds).toContain('deepseek-r1:8b');
    });

    it('should eliminate models with insufficient context window for massive tasks', () => {
      const hugeTaskInput = {
        prompt: 'Refactor the entire architecture across all modules',
        workspaceFilesCount: 50,
        activeFile: 'src/app.ts',
        selectedText: 'A'.repeat(80000), // ~22k tokens of selection + buffers > 32K context
      };
      const classification = TaskClassifier.classify(hugeTaskInput);
      expect(classification.estimatedContextTokens).toBeGreaterThan(32768);

      const result = router.route(hugeTaskInput);
      expect(result.selectedModel.contextWindow).toBeGreaterThanOrEqual(classification.estimatedContextTokens);
      // Qwen2.5-Coder-32B (context 32768) must be eliminated
      expect(result.selectedModel.id).not.toBe('Qwen/Qwen2.5-Coder-32B-Instruct');
      expect(result.selectedModel.id).toBe('Qwen/Qwen3-Coder-30B-A3B-Instruct'); // 131k context
    });

    it('should eliminate offline, unavailable, and rate-limited models', () => {
      registry.updateModelHealth('Qwen/Qwen3-Coder-30B-A3B-Instruct', 'unreachable', 'Network error');
      const result = router.route('Implement health check route');
      expect(result.selectedModel.id).not.toBe('Qwen/Qwen3-Coder-30B-A3B-Instruct');
      // Falls back to another free or local model
      expect(['Qwen/Qwen2.5-Coder-32B-Instruct', 'qwen2.5-coder:7b', 'mock-fast']).toContain(
        result.selectedModel.id,
      );
    });
  });

  describe('Financial Safety & Policy Enforcement', () => {
    it('NEVER automatically selects paid models in free-first mode when free models exist', () => {
      // Even if OpenAI/Anthropic are registered, auto mode must prioritize free/local
      const result = router.route('Write a new component');
      expect(result.selectedModel.access).not.toBe('paid');
      expect(['free', 'local']).toContain(result.selectedModel.access);
    });

    it('NEVER silently falls back to paid models unless explicitly enabled', () => {
      // Mark all free and local models unreachable
      const freeAndLocal = registry.listModels().filter((m) => m.access === 'free' || m.access === 'local');
      for (const m of freeAndLocal) {
        registry.updateModelHealth(m.id, 'unreachable');
      }

      // With allowPaidFallbackInAuto: false, routing must throw ModelError
      expect(() =>
        router.route('Implement OAuth handler', {
          allowPaidFallbackInAuto: false,
          configuredProviderIds: ['openai', 'anthropic'],
        }),
      ).toThrowError(ModelError);
    });

    it('permits paid fallback ONLY when explicitly enabled AND credentials configured', () => {
      // Mark all free and local models unreachable
      const freeAndLocal = registry.listModels().filter((m) => m.access === 'free' || m.access === 'local');
      for (const m of freeAndLocal) {
        registry.updateModelHealth(m.id, 'unreachable');
      }

      const result = router.route('Implement OAuth handler', {
        allowPaidFallbackInAuto: true,
        configuredProviderIds: ['anthropic'],
      });

      expect(result.selectedModel.access).toBe('paid');
      expect(result.selectedModel.providerId).toBe('anthropic');
    });

    it('strictly enforces local-only policy (never contacts cloud)', () => {
      const localRouter = new ModelRouter(registry, eventBus, {
        policy: 'local-only',
      });
      const result = localRouter.route('Add unit test for math.ts');
      expect(result.selectedModel.runtimeType).toBe('local');
      expect(result.fallbackCandidates.every((m) => m.runtimeType === 'local')).toBe(true);
    });

    it('strictly enforces free-and-local-only policy', () => {
      const freeLocalRouter = new ModelRouter(registry, eventBus, {
        policy: 'free-and-local-only',
        allowPaidFallbackInAuto: true, // Should be ignored by this policy
        configuredProviderIds: ['openai', 'ollama'],
      });
      const result = freeLocalRouter.route('Format JSON');
      expect(result.selectedModel.access).not.toBe('paid');
      expect(result.fallbackCandidates.every((m) => m.access !== 'paid')).toBe(true);
    });

    it('respects manual user selection when not set to auto', () => {
      const result = router.route('Fix issue', {
        preferredModelId: 'gpt-4o',
      });
      expect(result.selectedModel.id).toBe('gpt-4o');
      expect(result.reason).toContain('User manually selected');
    });
  });

  describe('Bounded Fallback & Lifecycle Events', () => {
    it('executes fallback cleanly and emits model.fallback event', () => {
      const events: Array<{ fromModel: string; toModel: string; attempt: number }> = [];
      eventBus.on('model.fallback', (e) => {
        events.push({ fromModel: e.fromModel, toModel: e.toModel, attempt: e.attempt });
      });

      const initial = router.route('Create CLI tool');
      expect(initial.attempt).toBe(0);
      const firstChoice = initial.selectedModel.id;

      // First fallback
      const fallback1 = router.routeFallback(initial, 'HTTP 429 Rate Limit Exceeded');
      expect(fallback1).not.toBeNull();
      expect(fallback1!.attempt).toBe(1);
      expect(fallback1!.selectedModel.id).not.toBe(firstChoice);
      expect(events).toHaveLength(1);
      expect(events[0].fromModel).toBe(firstChoice);
      expect(events[0].attempt).toBe(1);

      // Second fallback
      const fallback2 = router.routeFallback(fallback1!, 'HTTP 503 Provider Unavailable');
      expect(fallback2).not.toBeNull();
      expect(fallback2!.attempt).toBe(2);
      expect(events).toHaveLength(2);
      expect(events[1].attempt).toBe(2);

      // Third fallback MUST return null (enforcing max 2 attempts)
      const fallback3 = router.routeFallback(fallback2!, 'HTTP 500 Server Error');
      expect(fallback3).toBeNull();
    });

    it('penalizes repeatedly failing models in subsequent routing passes', () => {
      const initial = router.route('Build service');
      const preferredId = initial.selectedModel.id;
      const initialScore = initial.score;

      // Simulate 3 failures
      router.recordFailure(preferredId);
      router.recordFailure(preferredId);
      router.recordFailure(preferredId);

      const rerouted = router.route('Build service');
      // Model score must be lower or another model should be preferred
      if (rerouted.selectedModel.id === preferredId) {
        expect(rerouted.score).toBeLessThan(initialScore);
      } else {
        expect(rerouted.selectedModel.id).not.toBe(preferredId);
      }

      // Record success should reset penalty
      router.recordSuccess(preferredId);
      const recovered = router.route('Build service');
      expect(recovered.selectedModel.id).toBe(preferredId);
      expect(recovered.score).toBe(initialScore);
    });

    it('emits model.routed event with task metadata', () => {
      let routedEvent: any = null;
      eventBus.on('model.routed', (e) => {
        routedEvent = e;
      });

      router.route('Create REST controller');
      expect(routedEvent).not.toBeNull();
      expect(routedEvent.selectedModel).toBe('Qwen/Qwen3-Coder-30B-A3B-Instruct');
      expect(routedEvent.policy).toBe('free-first');
      expect(routedEvent.score).toBeGreaterThan(0);
      expect(routedEvent.fallbackAttempt).toBe(0);
    });
  });
});
