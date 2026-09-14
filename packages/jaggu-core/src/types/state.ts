export enum AgentState {
  IDLE = 'IDLE',
  UNDERSTANDING = 'UNDERSTANDING',
  PLANNING = 'PLANNING',
  PLAN_REVIEW = 'PLAN_REVIEW',
  EXECUTING = 'EXECUTING',
  EDIT_REVIEW = 'EDIT_REVIEW',
  APPLYING = 'APPLYING',
  VERIFYING = 'VERIFYING',
  DIAGNOSING = 'DIAGNOSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  // Backward-compatibility aliases
  THINKING = 'UNDERSTANDING',
  WAITING_FOR_APPROVAL = 'EDIT_REVIEW',
}

export type UiAgentStatus = 'IDLE' | 'PROCESSING' | 'AWAITING_APPROVAL' | 'SUCCESS' | 'ERROR' | 'CANCELLED';

export function agentStateToUiStatus(state: AgentState): UiAgentStatus {
  switch (state) {
    case AgentState.IDLE:
      return 'IDLE';
    case AgentState.UNDERSTANDING:
    case AgentState.PLANNING:
    case AgentState.EXECUTING:
    case AgentState.APPLYING:
    case AgentState.VERIFYING:
    case AgentState.DIAGNOSING:
      return 'PROCESSING';
    case AgentState.PLAN_REVIEW:
    case AgentState.EDIT_REVIEW:
      return 'AWAITING_APPROVAL';
    case AgentState.COMPLETED:
      return 'SUCCESS';
    case AgentState.FAILED:
      return 'ERROR';
    case AgentState.CANCELLED:
      return 'CANCELLED';
  }
}

export interface LoopGuardLimits {
  /** Maximum number of tool iterations per single user prompt */
  maxIterations: number;
  /** Maximum self-healing repair attempts for failing tests */
  maxRepairAttempts: number;
  /** Maximum plan revision attempts */
  maxPlanAttempts: number;
  /** Maximum consecutive identical tool calls */
  maxRepeatedToolCalls: number;
  /** Absolute task timeout in seconds */
  taskTimeoutSeconds: number;
}

export const DEFAULT_LOOP_LIMITS: LoopGuardLimits = {
  maxIterations: 20,
  maxRepairAttempts: 3,
  maxPlanAttempts: 2,
  maxRepeatedToolCalls: 2,
  taskTimeoutSeconds: 300,
};
