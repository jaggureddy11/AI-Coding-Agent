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
