import { AgentState, LoopGuardLimits, DEFAULT_LOOP_LIMITS } from '../types/state.js';
import { EventBus } from '../events/eventBus.js';

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly from: AgentState,
    public readonly to: AgentState,
  ) {
    super(`Invalid agent state transition from ${from} to ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class AgentStateMachine {
  private currentState: AgentState = AgentState.IDLE;
  private currentIteration: number = 0;
  private repairAttempts: number = 0;

  // Explicit allowed state transitions
  private static readonly ALLOWED_TRANSITIONS: Record<AgentState, ReadonlySet<AgentState>> = {
    [AgentState.IDLE]: new Set([AgentState.UNDERSTANDING, AgentState.CANCELLED]),
    [AgentState.UNDERSTANDING]: new Set([AgentState.PLANNING, AgentState.COMPLETED, AgentState.FAILED, AgentState.CANCELLED]),
    [AgentState.PLANNING]: new Set([AgentState.PLAN_REVIEW, AgentState.EDIT_REVIEW, AgentState.EXECUTING, AgentState.FAILED, AgentState.CANCELLED]),
    [AgentState.PLAN_REVIEW]: new Set([AgentState.EXECUTING, AgentState.PLANNING, AgentState.FAILED, AgentState.CANCELLED]),
    [AgentState.EXECUTING]: new Set([AgentState.EDIT_REVIEW, AgentState.VERIFYING, AgentState.COMPLETED, AgentState.FAILED, AgentState.CANCELLED]),
    [AgentState.EDIT_REVIEW]: new Set([AgentState.APPLYING, AgentState.EXECUTING, AgentState.FAILED, AgentState.CANCELLED]),
    [AgentState.APPLYING]: new Set([AgentState.VERIFYING, AgentState.EXECUTING, AgentState.COMPLETED, AgentState.FAILED, AgentState.CANCELLED]),
    [AgentState.VERIFYING]: new Set([AgentState.COMPLETED, AgentState.DIAGNOSING, AgentState.EXECUTING, AgentState.FAILED, AgentState.CANCELLED]),
    [AgentState.DIAGNOSING]: new Set([AgentState.EXECUTING, AgentState.PLANNING, AgentState.FAILED, AgentState.CANCELLED]),
    [AgentState.COMPLETED]: new Set([AgentState.IDLE]),
    [AgentState.FAILED]: new Set([AgentState.IDLE]),
    [AgentState.CANCELLED]: new Set([AgentState.IDLE]),
  };

  constructor(
    public readonly taskId: string,
    private readonly eventBus: EventBus,
    private readonly limits: LoopGuardLimits = DEFAULT_LOOP_LIMITS,
  ) {}

  getState(): AgentState {
    return this.currentState;
  }

  getIteration(): number {
    return this.currentIteration;
  }

  getRepairAttempts(): number {
    return this.repairAttempts;
  }

  transitionTo(nextState: AgentState, detail?: string): void {
    const allowed = AgentStateMachine.ALLOWED_TRANSITIONS[this.currentState];
    if (!allowed.has(nextState)) {
      throw new InvalidStateTransitionError(this.currentState, nextState);
    }

    // Enforce loop guards on execution cycles
    if (nextState === AgentState.EXECUTING) {
      this.currentIteration++;
      if (this.currentIteration > this.limits.maxIterations) {
        this.transitionTo(AgentState.FAILED, `Exceeded maximum iteration limit (${this.limits.maxIterations})`);
        return;
      }
    }

    if (
      (this.currentState === AgentState.VERIFYING || this.currentState === AgentState.DIAGNOSING) &&
      nextState === AgentState.EXECUTING
    ) {
      this.repairAttempts++;
      if (this.repairAttempts > this.limits.maxRepairAttempts) {
        this.transitionTo(AgentState.FAILED, `Exceeded maximum test-repair attempts (${this.limits.maxRepairAttempts})`);
        return;
      }
    }

    const previousState = this.currentState;
    this.currentState = nextState;

    this.eventBus.emit('agent.state_changed', {
      taskId: this.taskId,
      previousState,
      currentState: nextState,
      detail,
      timestamp: Date.now(),
    });
  }

  reset(): void {
    this.currentState = AgentState.IDLE;
    this.currentIteration = 0;
    this.repairAttempts = 0;
  }
}
