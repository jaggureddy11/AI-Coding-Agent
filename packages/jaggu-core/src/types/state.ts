export enum AgentState {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  PLANNING = 'PLANNING',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  EXECUTING = 'EXECUTING',
  VERIFYING = 'VERIFYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export type UiAgentStatus = 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'CANCELLED';

export function agentStateToUiStatus(state: AgentState): UiAgentStatus {
  switch (state) {
    case AgentState.IDLE:
      return 'IDLE';
    case AgentState.THINKING:
    case AgentState.PLANNING:
    case AgentState.WAITING_FOR_APPROVAL:
    case AgentState.EXECUTING:
    case AgentState.VERIFYING:
      return 'PROCESSING';
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
  /** Maximum self-healing repair attempts for the same failing test */
  maxRepairAttempts: number;
  /** Maximum consecutive identical tool calls */
  maxRepeatedToolCalls: number;
  /** Absolute task timeout in seconds */
  taskTimeoutSeconds: number;
}

export const DEFAULT_LOOP_LIMITS: LoopGuardLimits = {
  maxIterations: 20,
  maxRepairAttempts: 3,
  maxRepeatedToolCalls: 2,
  taskTimeoutSeconds: 300,
};
