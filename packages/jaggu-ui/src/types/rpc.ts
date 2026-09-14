import { AgentState, Plan, PlanStep, ApprovalRequest } from '@jaggu/core';

export type WebviewToExtensionMessage =
  | { type: 'SUBMIT_PROMPT'; payload: { prompt: string } }
  | { type: 'CANCEL_ACTIVE_TASK'; payload: { taskId: string } }
  | { type: 'APPROVE_PLAN'; payload: { planId: string } }
  | { type: 'RESOLVE_APPROVAL'; payload: { approvalId: string; decision: 'APPROVED' | 'REJECTED' } };

export type ExtensionToWebviewMessage =
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
