import { EventBus } from '../events/eventBus.js';
import { ModelRegistry } from './registry.js';
import { ModelDescriptor } from '../types/modelRegistry.js';
import { ModelError } from '../types/models.js';

export type ModelRoutingPolicy =
  'free-first' | 'free-and-local-only' | 'local-only' | 'configured-providers';

export type TaskCategory =
  | 'CODE_MUTATION'
  | 'BUG_FIX'
  | 'REFACTOR'
  | 'TEST_GENERATION'
  | 'EXPLANATION'
  | 'SEARCH'
  | 'GENERAL';

export interface TaskClassificationInput {
  prompt: string;
  activeFile?: string;
  selectedText?: string;
  diagnosticsCount?: number;
  workspaceFilesCount?: number;
  explicitCommand?: string;
}

export interface TaskClassification {
  category: TaskCategory;
  requiresTools: boolean;
  estimatedContextTokens: number;
  requiresMultiFile: boolean;
  reasoningWeight: number;
  codingWeight: number;
  summary: string;
}

export interface ModelRouterOptions {
  policy?: ModelRoutingPolicy;
  allowPaidFallbackInAuto?: boolean;
  configuredProviderIds?: string[];
  sessionFailures?: Map<string, number>;
  preferredModelId?: string;
}

export interface ModelRouteResult {
  selectedModel: ModelDescriptor;
  providerId: string;
  score: number;
  reason: string;
  policy: ModelRoutingPolicy;
  fallbackCandidates: ModelDescriptor[];
  taskClassification: TaskClassification;
  attempt: number;
}

/**
 * Deterministic TaskClassifier analyzing user intent and context requirements
 * without burning an external LLM call.
 */
export class TaskClassifier {
  public static classify(input: TaskClassificationInput | string): TaskClassification {
    const rawInput: TaskClassificationInput = typeof input === 'string' ? { prompt: input } : input;
    const prompt = rawInput.prompt.trim();
    const lower = prompt.toLowerCase();
    const command = rawInput.explicitCommand?.toLowerCase() || '';

    let category: TaskCategory = 'GENERAL';
    let requiresTools = true;
    let reasoningWeight = 0.5;
    let codingWeight = 0.8;

    // 1. Explicit Slash Commands
    if (command === '/explain' || lower.startsWith('/explain')) {
      category = 'EXPLANATION';
      requiresTools = false;
      reasoningWeight = 0.8;
      codingWeight = 0.5;
    } else if (command === '/test' || lower.startsWith('/test')) {
      category = 'TEST_GENERATION';
      requiresTools = true;
      reasoningWeight = 0.7;
      codingWeight = 0.9;
    } else if (command === '/fix' || lower.startsWith('/fix')) {
      category = 'BUG_FIX';
      requiresTools = true;
      reasoningWeight = 0.8;
      codingWeight = 0.9;
    } else if (command === '/refactor' || lower.startsWith('/refactor')) {
      category = 'REFACTOR';
      requiresTools = true;
      reasoningWeight = 0.75;
      codingWeight = 0.85;
    } else if (command === '/search' || lower.startsWith('/search')) {
      category = 'SEARCH';
      requiresTools = true;
      reasoningWeight = 0.5;
      codingWeight = 0.5;
    } else if (command === '/plan' || lower.startsWith('/plan')) {
      category = 'CODE_MUTATION';
      requiresTools = true;
      reasoningWeight = 0.85;
      codingWeight = 0.8;
    }
    // 2. Natural language heuristics
    else if (
      /\b(how does|what is|why does|explain|walk me through|describe|clarify|what are)\b/i.test(
        lower,
      ) &&
      !/\b(fix|change|update|add|write|create|implement|modify|delete|remove)\b/i.test(lower)
    ) {
      category = 'EXPLANATION';
      requiresTools = false;
      reasoningWeight = 0.8;
      codingWeight = 0.5;
    } else if (/\b(test|spec|jest|vitest|unit test|integration test|coverage)\b/i.test(lower)) {
      category = 'TEST_GENERATION';
      requiresTools = true;
      codingWeight = 0.85;
    } else if (/\b(fix|bug|error|crash|failing|broken|issue|diagnostic|exception)\b/i.test(lower)) {
      category = 'BUG_FIX';
      requiresTools = true;
      reasoningWeight = 0.8;
      codingWeight = 0.9;
    } else if (/\b(refactor|clean up|restructure|extract|simplify|modernize)\b/i.test(lower)) {
      category = 'REFACTOR';
      requiresTools = true;
      codingWeight = 0.85;
    } else if (/\b(find|search|grep|locate|where is|files containing)\b/i.test(lower)) {
      category = 'SEARCH';
      requiresTools = true;
    } else if (
      /\b(implement|create|add|build|generate|write|update|modify|change)\b/i.test(lower)
    ) {
      category = 'CODE_MUTATION';
      requiresTools = true;
      codingWeight = 0.9;
    }

    // 3. Multi-file heuristic
    const requiresMultiFile =
      /\b(all files|project|workspace|across|components|entire|multiple files|modules)\b/i.test(
        lower,
      ) ||
      (rawInput.workspaceFilesCount !== undefined && rawInput.workspaceFilesCount > 20);

    // 4. Deterministic token estimation
    let estimatedTokens = Math.max(512, Math.ceil(prompt.length / 3.5));
    if (rawInput.activeFile) {
      estimatedTokens += 1500;
    }
    if (rawInput.selectedText) {
      estimatedTokens += Math.ceil(rawInput.selectedText.length / 3.5);
    }
    if (rawInput.diagnosticsCount && rawInput.diagnosticsCount > 0) {
      estimatedTokens += rawInput.diagnosticsCount * 120;
    }
    // Baseline buffer for tool definitions, schema overhead and system instructions
    estimatedTokens += requiresTools ? 4096 : 2048;
    if (requiresMultiFile) {
      estimatedTokens += 8192;
    }

    return {
      category,
      requiresTools,
      estimatedContextTokens: estimatedTokens,
      requiresMultiFile,
      reasoningWeight,
      codingWeight,
      summary: `Category: ${category}, Tools: ${requiresTools ? 'Required' : 'Optional'}, Est. Context: ${estimatedTokens} tokens`,
    };
  }
}

/**
 * ModelRouter selects the optimal model descriptor for any coding task based on:
 * - Task characteristics (tool use, context size)
 * - User policy (free-first, free-and-local-only, local-only, configured-providers)
 * - Model capabilities & benchmarks
 * - Health and access tier
 * - Previous session transient failures
 */
export class ModelRouter {
  private policy: ModelRoutingPolicy;
  private allowPaidFallbackInAuto: boolean;
  private configuredProviders: Set<string>;
  private readonly sessionFailures: Map<string, number>;

  constructor(
    private readonly registry: ModelRegistry,
    private readonly eventBus?: EventBus,
    options: ModelRouterOptions = {},
  ) {
    this.policy = options.policy ?? 'free-first';
    this.allowPaidFallbackInAuto = options.allowPaidFallbackInAuto ?? false;
    this.configuredProviders = new Set(options.configuredProviderIds ?? []);
    this.sessionFailures = options.sessionFailures ?? new Map();
  }

  public getPolicy(): ModelRoutingPolicy {
    return this.policy;
  }

  public setPolicy(policy: ModelRoutingPolicy): void {
    this.policy = policy;
  }

  public isPaidFallbackAllowed(): boolean {
    return this.allowPaidFallbackInAuto;
  }

  public setAllowPaidFallback(allow: boolean): void {
    this.allowPaidFallbackInAuto = allow;
  }

  public setConfiguredProviders(providerIds: string[]): void {
    this.configuredProviders = new Set(providerIds);
  }

  public recordFailure(modelId: string): void {
    const current = this.sessionFailures.get(modelId) ?? 0;
    this.sessionFailures.set(modelId, current + 1);
  }

  public recordSuccess(modelId: string): void {
    this.sessionFailures.delete(modelId);
  }

  /**
   * Routes a task to the optimal model.
   */
  public route(
    taskInput: TaskClassificationInput | string,
    optionsOverride?: Partial<ModelRouterOptions>,
  ): ModelRouteResult {
    const task = TaskClassifier.classify(taskInput);
    const policy = optionsOverride?.policy ?? this.policy;
    const allowPaid = optionsOverride?.allowPaidFallbackInAuto ?? this.allowPaidFallbackInAuto;
    const preferredModelId = optionsOverride?.preferredModelId;
    const configuredProviders = optionsOverride?.configuredProviderIds
      ? new Set(optionsOverride.configuredProviderIds)
      : this.configuredProviders;

    // 1. Manual User Selection (Explicit override, not Auto)
    if (preferredModelId && preferredModelId.toLowerCase() !== 'auto') {
      const manualModel = this.registry.findModel(preferredModelId);
      if (manualModel) {
        const result: ModelRouteResult = {
          selectedModel: manualModel,
          providerId: manualModel.providerId,
          score: 1.0,
          reason: `User manually selected ${manualModel.displayName}`,
          policy,
          fallbackCandidates: [],
          taskClassification: task,
          attempt: 0,
        };
        this.emitRoutedEvent(result);
        return result;
      }
    }

    const allModels = this.registry.listModels();

    // 2. Candidate Filtering
    const eligibleModels = allModels.filter((model) => {
      // Tool-calling requirement
      if (task.requiresTools && !model.capabilities.toolCalling) {
        return false;
      }

      // Context window capacity
      if (task.estimatedContextTokens > model.contextWindow) {
        return false;
      }

      // Unavailability / offline / rate-limited status
      if (model.availability === 'offline' || model.availability === 'unavailable') {
        return false;
      }
      if (model.availability === 'rate-limited') {
        return false;
      }
      if (model.health === 'unreachable' || model.health === 'not_installed') {
        return false;
      }

      // If configured providers list is specified, only models belonging to configuredProviders are eligible
      if (configuredProviders.size > 0 && !configuredProviders.has(model.providerId)) {
        return false;
      }

      // Authentication requirement check
      if (model.availability === 'auth-required' || model.health === 'missing_credentials') {
        if (configuredProviders.size > 0 && !configuredProviders.has(model.providerId)) {
          return false;
        }
      }

      // Policy Enforcement
      if (policy === 'local-only') {
        return model.runtimeType === 'local';
      }

      if (policy === 'free-and-local-only') {
        return model.access === 'free' || model.access === 'local';
      }

      return true;
    });

    // 3. Free-First Preference Partitioning:
    // If policy is 'free-first', paid models are filtered out if any free/local candidates exist.
    let pool = eligibleModels;
    if (policy === 'free-first') {
      const freeOrLocal = eligibleModels.filter((m) => m.access === 'free' || m.access === 'local');
      if (freeOrLocal.length > 0) {
        pool = freeOrLocal;
      } else {
        // No free/local models survived. Only use paid if user explicitly enabled it AND credentials exist.
        if (allowPaid) {
          pool = eligibleModels.filter(
            (m) => m.access === 'paid' && configuredProviders.has(m.providerId),
          );
        } else {
          pool = [];
        }
      }
    }

    if (pool.length === 0) {
      throw new ModelError(
        `No AI model is currently available that satisfies your task requirements and routing policy (${policy}). ` +
          `Install a local Ollama model or configure a supported provider in JAGGU Settings.`,
        'MODEL_NOT_FOUND',
        'router',
      );
    }

    // 4. Multi-Factor Scoring
    const scoredCandidates = pool.map((model) => {
      const score = this.calculateScore(model, task);
      return { model, score };
    });

    // Sort descending by score. Tie-break: prefer Qwen3-Coder family, then other Qwen, then local.
    scoredCandidates.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.001) {
        return b.score - a.score;
      }
      const aIsQwen3 = a.model.modelFamily === 'qwen3-coder' ? 1 : 0;
      const bIsQwen3 = b.model.modelFamily === 'qwen3-coder' ? 1 : 0;
      if (bIsQwen3 !== aIsQwen3) {
        return bIsQwen3 - aIsQwen3;
      }
      const aIsLocal = a.model.runtimeType === 'local' ? 1 : 0;
      const bIsLocal = b.model.runtimeType === 'local' ? 1 : 0;
      return bIsLocal - aIsLocal;
    });

    const selected = scoredCandidates[0];
    if (!selected) {
      throw new ModelError(
        `No AI model survived scoring for policy (${policy}).`,
        'MODEL_NOT_FOUND',
        'router',
      );
    }
    const fallbackCandidates = scoredCandidates.slice(1).map((c) => c.model);

    const reason = this.buildSelectionReason(selected.model, task, selected.score);

    const result: ModelRouteResult = {
      selectedModel: selected.model,
      providerId: selected.model.providerId,
      score: selected.score,
      reason,
      policy,
      fallbackCandidates,
      taskClassification: task,
      attempt: 0,
    };

    this.emitRoutedEvent(result);
    return result;
  }

  /**
   * Safely routes to the next best fallback candidate upon transient provider failure.
   * Maximum 2 attempts enforced to prevent infinite loops.
   */
  public routeFallback(
    previousResult: ModelRouteResult,
    failureReason: string,
  ): ModelRouteResult | null {
    if (previousResult.attempt >= 2) {
      return null;
    }

    this.recordFailure(previousResult.selectedModel.id);

    if (previousResult.fallbackCandidates.length === 0) {
      return null;
    }

    const nextModel = previousResult.fallbackCandidates[0];
    if (!nextModel) {
      return null;
    }
    const remainingFallbacks = previousResult.fallbackCandidates.slice(1);
    const nextAttempt = previousResult.attempt + 1;

    const fallbackResult: ModelRouteResult = {
      selectedModel: nextModel,
      providerId: nextModel.providerId,
      score: this.calculateScore(nextModel, previousResult.taskClassification),
      reason: `Fallback from ${previousResult.selectedModel.displayName} due to: ${failureReason}`,
      policy: previousResult.policy,
      fallbackCandidates: remainingFallbacks,
      taskClassification: previousResult.taskClassification,
      attempt: nextAttempt,
    };

    if (this.eventBus) {
      this.eventBus.emit('model.fallback', {
        taskId: 'current',
        fromModel: previousResult.selectedModel.id,
        toModel: nextModel.id,
        provider: nextModel.providerId,
        reason: failureReason,
        attempt: nextAttempt,
        timestamp: Date.now(),
      });
    }

    this.emitRoutedEvent(fallbackResult);
    return fallbackResult;
  }

  private calculateScore(model: ModelDescriptor, task: TaskClassification): number {
    const coding = (model.capabilities.coding ?? 80) / 100;
    const reasoning = (model.capabilities.reasoning ?? 80) / 100;
    const toolScore = model.capabilities.toolCalling ? 1.0 : task.requiresTools ? 0.0 : 0.8;

    // Context fit: optimal if spacious, minor penalty if tight
    const contextRatio = task.estimatedContextTokens / model.contextWindow;
    const contextFit = contextRatio > 0.8 ? 0.6 : 1.0;

    // Access tier bonus (favor free open models, then local models)
    let accessBonus = 0;
    if (model.access === 'free') {
      accessBonus = 0.35;
    } else if (model.access === 'local') {
      accessBonus = 0.3;
    } else if (model.access === 'paid') {
      accessBonus = 0.0;
    }

    // Health factor
    let healthFactor = 0.8;
    if (model.healthInfo?.healthy !== undefined) {
      healthFactor = model.healthInfo.healthy ? 1.0 : 0.2;
    } else if (model.health === 'available') {
      healthFactor = 1.0;
    } else if (model.health === 'unknown') {
      healthFactor = 0.7;
    }

    // Recent session failure penalty: 0.25 per failure
    const failures = this.sessionFailures.get(model.id) ?? 0;
    const failurePenalty = failures * 0.25;

    // Weighted formula:
    // coding (0.35) + reasoning (0.15) + tools (0.15) + contextFit (0.10) + access (0.20) + health (0.05) - failures (0.25)
    const baseScore =
      coding * 0.35 +
      reasoning * 0.15 +
      toolScore * 0.15 +
      contextFit * 0.1 +
      accessBonus * 0.2 +
      healthFactor * 0.05 -
      failurePenalty;

    return Math.max(0, Math.round(baseScore * 1000) / 1000);
  }

  private buildSelectionReason(
    model: ModelDescriptor,
    task: TaskClassification,
    score: number,
  ): string {
    const accessDesc =
      model.access === 'free'
        ? 'Free/Open model'
        : model.access === 'local'
          ? 'Local offline model'
          : 'Configured provider';

    const toolDesc = task.requiresTools ? 'tool calling supported' : 'explanation optimized';
    return `${accessDesc} (${model.displayName}): coding rating ${model.capabilities.coding ?? 80}, ${toolDesc}, score: ${score}`;
  }

  private emitRoutedEvent(result: ModelRouteResult): void {
    if (this.eventBus) {
      this.eventBus.emit('model.routed', {
        taskId: 'current',
        selectedModel: result.selectedModel.id,
        provider: result.providerId,
        policy: result.policy,
        reason: result.reason,
        score: result.score,
        fallbackAttempt: result.attempt,
        timestamp: Date.now(),
      });
    }
  }
}
