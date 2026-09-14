import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '../src/App.js';
import { StatusPill } from '../src/components/StatusPill.js';
import { PlanCard } from '../src/components/PlanCard.js';
import { AgentState, Plan } from '@jaggu/core';
import { ChatMessage } from '../src/types/rpc.js';

describe('JAGGU UI Webview Shell', () => {
  it('should render StatusPill with correct labels and theme colors', () => {
    const idleHtml = renderToString(<StatusPill state="IDLE" />);
    expect(idleHtml).toContain('Ready');
    expect(idleHtml).toContain('status-pill');

    const procHtml = renderToString(<StatusPill state="PROCESSING" />);
    expect(procHtml).toContain('Processing');

    const errHtml = renderToString(<StatusPill state="ERROR" />);
    expect(errHtml).toContain('Error');

    const cancelHtml = renderToString(<StatusPill state="CANCELLED" />);
    expect(cancelHtml).toContain('Cancelled');

    const agentStateHtml = renderToString(<StatusPill state={AgentState.COMPLETED} />);
    expect(agentStateHtml).toContain('Success');
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

  it('should render empty state when no messages exist', () => {
    const html = renderToString(<App initialStatus="IDLE" />);
    expect(html).toContain('JAGGU');
    expect(html).toContain('What would you like me to build?');
    expect(html).toContain('Type a task...');
    expect(html).toContain('Send');
    expect(html).toContain('Ready');
    expect(html).not.toContain('data-testid="clear-btn"');
  });

  it('should render user and assistant messages and show Clear button in chat thread', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', text: 'Explain this project', timestamp: 1700000000000 },
      { id: '2', role: 'assistant', text: 'JAGGU is an autonomous AI coding agent.', timestamp: 1700000001000 },
    ];

    const html = renderToString(<App initialStatus="IDLE" initialMessages={messages} />);
    expect(html).toContain('Explain this project');
    expect(html).toContain('JAGGU is an autonomous AI coding agent.');
    expect(html).toContain('data-testid="message-user"');
    expect(html).toContain('data-testid="message-assistant"');
    expect(html).toContain('data-testid="clear-btn"');
    expect(html).not.toContain('What would you like me to build?');
  });

  it('should render processing indicator and Cancel button during PROCESSING status', () => {
    const html = renderToString(<App initialStatus="PROCESSING" />);
    expect(html).toContain('data-testid="cancel-btn"');
    expect(html).toContain('Cancel');
    expect(html).toContain('JAGGU is processing your request...');
    expect(html).toContain('Processing');
  });
});
