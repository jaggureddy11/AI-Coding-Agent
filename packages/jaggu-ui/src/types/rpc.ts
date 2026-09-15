import type {
  AgentState,
  Plan,
  PlanStep,
  ApprovalRequest,
  UiAgentStatus,
  ContextSnippetSummary,
  ModelDescriptor,
  ModelHealthStatus,
} from '@jaggu/core';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  provenance?: ContextSnippetSummary[];
}

export type WebviewToExtensionMessage =
  | { type: 'user.submit'; payload: { id: string; text: string; timestamp: number } }
  | { type: 'agent.cancel'; payload?: { taskId?: string } }
  | { type: 'ui.ready'; payload?: { timestamp: number } }
  | { type: 'ui.clear'; payload?: Record<string, never> }
  | { type: 'model.select'; payload: { modelId: string } }
  | { type: 'models.refresh_health'; payload?: Record<string, never> }
  | { type: 'agent.approve'; payload: { proposalId: string } }
  | { type: 'agent.reject'; payload: { proposalId: string; reason?: string } }
  | { type: 'agent.review_diff'; payload: { filePath: string } }
  | { type: 'agent.plan_approve'; payload: { planId: string } }
  | { type: 'agent.plan_reject'; payload: { planId: string; reason?: string } }
  | { type: 'agent.editset_approve'; payload: { editSetId: string; approvedFiles?: string[]; rejectedFiles?: string[] } }
  | { type: 'agent.editset_reject'; payload: { editSetId: string; reason?: string } }
  | { type: 'agent.scope_approve'; payload?: { taskId?: string } }
  | { type: 'agent.scope_reject'; payload?: { taskId?: string } }
  // Extended types for future plan approvals
  | { type: 'SUBMIT_PROMPT'; payload: { prompt: string } }
  | { type: 'CANCEL_ACTIVE_TASK'; payload: { taskId: string } }
  | { type: 'APPROVE_PLAN'; payload: { planId: string } }
  | { type: 'RESOLVE_APPROVAL'; payload: { approvalId: string; decision: 'APPROVED' | 'REJECTED' } };

export type ExtensionToWebviewMessage =
  | { type: 'agent.status'; payload: { state: UiAgentStatus; detail?: string } }
  | { type: 'agent.message'; payload: ChatMessage }
  | { type: 'agent.error'; payload: { code?: string; message: string } }
  | { type: 'agent.config'; payload: { provider: string; model: string; models?: ModelDescriptor[] } }
  | { type: 'model.health_changed'; payload: { modelId: string; health: ModelHealthStatus; detail?: string } }
  | { type: 'model.routed'; payload: { selectedModel: string; provider: string; policy: string; reason: string; score: number } }
  | { type: 'model.fallback'; payload: { fromModel: string; toModel: string; provider: string; reason: string; attempt: number } }
  | { type: 'token.delta'; payload: { text: string; messageId: string } }
  | { type: 'token.complete'; payload: { messageId: string; fullText: string; tokensUsed?: number; provenance?: ContextSnippetSummary[] } }
  | { type: 'context.assembled'; payload: { taskId: string; filesCount: number; totalTokens: number; provenance: ContextSnippetSummary[] } }
  | { type: 'agent.approval_requested'; payload: { proposalId: string; filePath: string; diffSummary: string; timestamp: number } }
  | { type: 'agent.plan_requested'; payload: { taskId: string; planId: string; goal: string; steps: Array<{ id: string; description: string; files: string[] }>; risks: string[]; verification: string[] } }
  | { type: 'agent.editset_requested'; payload: { taskId: string; editSetId: string; files: Array<{ relativePath: string; shadowUri: string; isNew?: boolean }> } }
  | { type: 'agent.scope_change_requested'; payload: { taskId: string; unplannedFiles: string[]; reason: string } }
  | { type: 'agent.activity'; payload: { message: string } }
  | { type: 'AGENT_STATE_CHANGED'; payload: { state: AgentState; detail?: string } }
  | { type: 'TOKEN_STREAM_CHUNK'; payload: { text: string } }
  | { type: 'PLAN_GENERATED'; payload: Plan }
  | { type: 'PLAN_STEP_UPDATED'; payload: { stepIndex: number; status: PlanStep['status'] } }
  | { type: 'APPROVAL_REQUESTED'; payload: ApprovalRequest }
  | { type: 'TASK_COMPLETED'; payload: { summary: string } }
  | { type: 'TASK_ERROR'; payload: { error: string } };

export interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

/**
 * Validates whether an incoming raw object conforms to the WebviewToExtensionMessage contract.
 */
export function isValidWebviewMessage(msg: unknown): msg is WebviewToExtensionMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const candidate = msg as { type?: unknown; payload?: unknown };
  if (typeof candidate.type !== 'string') return false;

  switch (candidate.type) {
    case 'user.submit': {
      const p = candidate.payload as { id?: unknown; text?: unknown; timestamp?: unknown };
      return (
        typeof p === 'object' &&
        p !== null &&
        typeof p.id === 'string' &&
        typeof p.text === 'string' &&
        typeof p.timestamp === 'number'
      );
    }
    case 'agent.cancel':
    case 'ui.ready':
    case 'ui.clear':
    case 'models.refresh_health':
      return candidate.payload === undefined || (typeof candidate.payload === 'object' && candidate.payload !== null);
    case 'model.select': {
      const p = candidate.payload as { modelId?: unknown };
      return typeof p === 'object' && p !== null && typeof p.modelId === 'string' && p.modelId.trim().length > 0;
    }
    case 'SUBMIT_PROMPT': {
      const p = candidate.payload as { prompt?: unknown };
      return typeof p === 'object' && p !== null && typeof p.prompt === 'string';
    }
    case 'CANCEL_ACTIVE_TASK': {
      const p = candidate.payload as { taskId?: unknown };
      return typeof p === 'object' && p !== null && typeof p.taskId === 'string';
    }
    case 'agent.approve': {
      const p = candidate.payload as { proposalId?: unknown };
      return typeof p === 'object' && p !== null && typeof p.proposalId === 'string';
    }
    case 'agent.reject': {
      const p = candidate.payload as { proposalId?: unknown };
      return typeof p === 'object' && p !== null && typeof p.proposalId === 'string';
    }
    case 'agent.review_diff': {
      const p = candidate.payload as { filePath?: unknown };
      return typeof p === 'object' && p !== null && typeof p.filePath === 'string';
    }
    case 'agent.plan_approve': {
      const p = candidate.payload as { planId?: unknown };
      return typeof p === 'object' && p !== null && typeof p.planId === 'string';
    }
    case 'agent.plan_reject': {
      const p = candidate.payload as { planId?: unknown };
      return typeof p === 'object' && p !== null && typeof p.planId === 'string';
    }
    case 'agent.editset_approve': {
      const p = candidate.payload as { editSetId?: unknown };
      return typeof p === 'object' && p !== null && typeof p.editSetId === 'string';
    }
    case 'agent.editset_reject': {
      const p = candidate.payload as { editSetId?: unknown };
      return typeof p === 'object' && p !== null && typeof p.editSetId === 'string';
    }
    case 'agent.scope_approve':
    case 'agent.scope_reject':
      return candidate.payload === undefined || (typeof candidate.payload === 'object' && candidate.payload !== null);
    case 'APPROVE_PLAN': {
      const p = candidate.payload as { planId?: unknown };
      return typeof p === 'object' && p !== null && typeof p.planId === 'string';
    }
    case 'RESOLVE_APPROVAL': {
      const p = candidate.payload as { approvalId?: unknown; decision?: unknown };
      return (
        typeof p === 'object' &&
        p !== null &&
        typeof p.approvalId === 'string' &&
        (p.decision === 'APPROVED' || p.decision === 'REJECTED')
      );
    }
    default:
      return false;
  }
}

/**
 * Validates whether an incoming raw object conforms to the ExtensionToWebviewMessage contract.
 */
export function isValidExtensionMessage(msg: unknown): msg is ExtensionToWebviewMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const candidate = msg as { type?: unknown; payload?: unknown };
  if (typeof candidate.type !== 'string') return false;

  const validTypes = [
    'agent.status',
    'agent.message',
    'agent.error',
    'agent.config',
    'model.health_changed',
    'model.routed',
    'model.fallback',
    'token.delta',
    'token.complete',
    'context.assembled',
    'agent.approval_requested',
    'agent.plan_requested',
    'agent.editset_requested',
    'agent.scope_change_requested',
    'agent.activity',
    'AGENT_STATE_CHANGED',
    'TOKEN_STREAM_CHUNK',
    'PLAN_GENERATED',
    'PLAN_STEP_UPDATED',
    'APPROVAL_REQUESTED',
    'TASK_COMPLETED',
    'TASK_ERROR',
  ];

  return validTypes.includes(candidate.type);
}
