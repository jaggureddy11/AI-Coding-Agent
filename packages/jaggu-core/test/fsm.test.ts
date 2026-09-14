import { describe, it, expect } from 'vitest';
import { AgentStateMachine, InvalidStateTransitionError } from '../src/agent/fsm.js';
import { AgentState } from '../src/types/state.js';
import { EventBus } from '../src/events/eventBus.js';
import { InMemoryVirtualDocStore } from '../src/diff/virtualDocStore.js';

describe('AgentStateMachine', () => {
  it('should initialize in IDLE state', () => {
    const eventBus = new EventBus();
    const fsm = new AgentStateMachine('task_001', eventBus);
    expect(fsm.getState()).toBe(AgentState.IDLE);
    expect(fsm.getIteration()).toBe(0);
  });

  it('should transition through valid happy path', () => {
    const eventBus = new EventBus();
    const transitions: AgentState[] = [];
    eventBus.on('agent.state_changed', (e) => {
      transitions.push(e.currentState);
    });

    const fsm = new AgentStateMachine('task_001', eventBus);
    fsm.transitionTo(AgentState.THINKING);
    fsm.transitionTo(AgentState.PLANNING);
    fsm.transitionTo(AgentState.WAITING_FOR_APPROVAL);
    fsm.transitionTo(AgentState.EXECUTING);
    fsm.transitionTo(AgentState.VERIFYING);
    fsm.transitionTo(AgentState.COMPLETED);

    expect(fsm.getState()).toBe(AgentState.COMPLETED);
    expect(transitions).toEqual([
      AgentState.THINKING,
      AgentState.PLANNING,
      AgentState.WAITING_FOR_APPROVAL,
      AgentState.EXECUTING,
      AgentState.VERIFYING,
      AgentState.COMPLETED,
    ]);
  });

  it('should throw on illegal transition', () => {
    const eventBus = new EventBus();
    const fsm = new AgentStateMachine('task_001', eventBus);
    expect(() => fsm.transitionTo(AgentState.EXECUTING)).toThrow(InvalidStateTransitionError);
  });

  it('should trigger FAILED when max iterations are exceeded', () => {
    const eventBus = new EventBus();
    const fsm = new AgentStateMachine('task_001', eventBus, {
      maxIterations: 2,
      maxRepairAttempts: 3,
      maxRepeatedToolCalls: 2,
      taskTimeoutSeconds: 60,
    });

    fsm.transitionTo(AgentState.THINKING);
    fsm.transitionTo(AgentState.PLANNING);
    fsm.transitionTo(AgentState.EXECUTING); // Iteration 1
    fsm.transitionTo(AgentState.WAITING_FOR_APPROVAL);
    fsm.transitionTo(AgentState.EXECUTING); // Iteration 2
    fsm.transitionTo(AgentState.WAITING_FOR_APPROVAL);
    fsm.transitionTo(AgentState.EXECUTING); // Exceeds max 2 -> transitions to FAILED

    expect(fsm.getState()).toBe(AgentState.FAILED);
  });
});

describe('InMemoryVirtualDocStore', () => {
  it('should store, retrieve, and delete virtual documents', () => {
    const store = new InMemoryVirtualDocStore();
    store.set('jaggu-shadow://src/test.ts', 'const a = 1;', 'const a = 2;');

    expect(store.has('jaggu-shadow://src/test.ts')).toBe(true);
    const doc = store.get('jaggu-shadow://src/test.ts');
    expect(doc?.originalContent).toBe('const a = 1;');
    expect(doc?.proposedContent).toBe('const a = 2;');

    store.delete('jaggu-shadow://src/test.ts');
    expect(store.has('jaggu-shadow://src/test.ts')).toBe(false);
  });
});
