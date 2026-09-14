import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '../src/App.js';
import { StatusPill } from '../src/components/StatusPill.js';
import { PlanCard } from '../src/components/PlanCard.js';
import { AgentState, Plan } from '@jaggu/core';

describe('JAGGU UI Webview Shell', () => {
  it('should render StatusPill with correct label', () => {
    const html = renderToString(<StatusPill state={AgentState.THINKING} />);
    expect(html).toContain('THINKING');
    expect(html).toContain('status-pill');
  });

  it('should render PlanCard with steps', () => {
    const mockPlan: Plan = {
      id: 'plan_01',
      taskId: 'task_01',
      title: 'Implement Healthcheck',
      approved: false,
      steps: [
        { stepIndex: 1, description: 'Create health.ts', targetFiles: ['src/health.ts'], status: 'COMPLETED' },
        { stepIndex: 2, description: 'Register route', targetFiles: ['src/routes.ts'], status: 'RUNNING' },
      ],
    };

    const html = renderToString(<PlanCard plan={mockPlan} />);
    expect(html).toContain('Implement Healthcheck');
    expect(html).toContain('Create health.ts');
    expect(html).toContain('Register route');
    expect(html).toContain('Approve Plan');
  });

  it('should render root App container with idle message', () => {
    const html = renderToString(<App initialState={AgentState.IDLE} />);
    expect(html).toContain('JAGGU');
    expect(html).toContain('IDLE');
    expect(html).toContain('Ready for your engineering instructions');
  });
});
