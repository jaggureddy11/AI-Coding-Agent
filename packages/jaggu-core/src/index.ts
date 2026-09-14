// State & Lifecycle
export * from './types/state.js';
export * from './types/events.js';
export * from './events/eventBus.js';
export * from './agent/fsm.js';

// Subsystem Contracts & Models
export * from './types/models.js';
export * from './types/modelRegistry.js';
export * from './models/transport.js';
export * from './models/openai.js';
export * from './models/anthropic.js';
export * from './models/gemini.js';
export * from './models/huggingface.js';
export * from './models/ollama.js';
export * from './models/openaiCompatible.js';
export * from './models/mock.js';
export * from './models/registry.js';
export * from './models/gateway.js';

// Tools, Context, Task, Diff
export * from './types/tools.js';
export * from './types/context.js';
export * from './types/task.js';
export * from './types/diff.js';
export * from './diff/virtualDocStore.js';

// Repository Context & Code Intelligence (M3)
export * from './context/workspace.js';
export * from './context/ripgrep.js';
export * from './context/repoMap.js';
export * from './context/promptInjection.js';
export * from './context/engine.js';

// Tool Execution, File Editing & Workspace Mutation (M4)
export * from './tools/index.js';

// Agent Planning, Multi-File Changes & Verification (M5)
export * from './types/plan.js';
export * from './planning/planValidator.js';
export * from './planning/planner.js';
export * from './types/editSet.js';
export * from './diff/editSetManager.js';
export * from './types/verification.js';
export * from './verification/verificationEngine.js';
export * from './agent/agentOrchestrator.js';

// Code Intelligence, Git Safety & Developer Feedback (M6)
export * from './types/diagnostics.js';
export * from './types/git.js';
export * from './git/gitService.js';
export * from './git/taskCheckpointManager.js';
