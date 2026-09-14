import React, { useState } from 'react';
import { AgentState, Plan } from '@jaggu/core';
import { StatusPill } from './components/StatusPill.js';
import { PlanCard } from './components/PlanCard.js';
import { VsCodeApi } from './types/rpc.js';

interface AppProps {
  vscode?: VsCodeApi;
  initialState?: AgentState;
  initialPlan?: Plan;
}

export const App: React.FC<AppProps> = ({ vscode, initialState = AgentState.IDLE, initialPlan }) => {
  const [state, setState] = useState<AgentState>(initialState);
  const [plan, setPlan] = useState<Plan | undefined>(initialPlan);
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    vscode?.postMessage({
      type: 'SUBMIT_PROMPT',
      payload: { prompt },
    });
    setState(AgentState.THINKING);
    setPrompt('');
  };

  const handleApprovePlan = (planId: string) => {
    vscode?.postMessage({
      type: 'APPROVE_PLAN',
      payload: { planId },
    });
    if (plan) {
      setPlan({ ...plan, approved: true });
    }
  };

  return (
    <div
      data-testid="jaggu-sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '12px',
        fontFamily: 'var(--vscode-font-family, sans-serif)',
        color: 'var(--vscode-foreground, #cccccc)',
        backgroundColor: 'var(--vscode-sideBar-background, #252526)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em' }}>JAGGU</h3>
        <StatusPill state={state} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
        {plan && <PlanCard plan={plan} onApprove={handleApprovePlan} />}
        {state === AgentState.IDLE && !plan && (
          <div style={{ color: 'var(--vscode-descriptionForeground, #858585)', fontSize: '12px', marginTop: '16px' }}>
            Ready for your engineering instructions. Ask a question or assign a coding task.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '6px' }}>
        <input
          data-testid="prompt-input"
          type="text"
          value={prompt}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrompt(e.target.value)}
          placeholder="Ask JAGGU to inspect, plan, or edit..."
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: '3px',
            border: '1px solid var(--vscode-input-border, #3c3c3c)',
            backgroundColor: 'var(--vscode-input-background, #3c3c3c)',
            color: 'var(--vscode-input-foreground, #cccccc)',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <button
          data-testid="submit-btn"
          type="submit"
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--vscode-button-background, #0e639c)',
            color: 'var(--vscode-button-foreground, #ffffff)',
            border: 'none',
            borderRadius: '3px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};
