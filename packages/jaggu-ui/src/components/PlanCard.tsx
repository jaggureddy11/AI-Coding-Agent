import React from 'react';
import type { Plan } from '@jaggu/core';

interface PlanCardProps {
  plan: Plan;
  onApprove?: (planId: string) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, onApprove }) => {
  return (
    <div
      data-testid="plan-card"
      style={{
        border: '1px solid var(--vscode-widget-border, #454545)',
        borderRadius: '6px',
        padding: '12px',
        margin: '8px 0',
        backgroundColor: 'var(--vscode-sideBar-background, #252526)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{plan.title}</h4>
        {plan.approved ? (
          <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: 600 }}>APPROVED</span>
        ) : (
          <button
            data-testid="approve-plan-btn"
            onClick={() => onApprove?.(plan.id)}
            style={{
              backgroundColor: 'var(--vscode-button-background, #0e639c)',
              color: 'var(--vscode-button-foreground, #ffffff)',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Approve Plan
          </button>
        )}
      </div>
      <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: 0 }}>
        {plan.steps.map((step) => (
          <li
            key={step.stepIndex}
            style={{
              padding: '4px 0',
              fontSize: '12px',
              color: step.status === 'COMPLETED' ? 'var(--vscode-descriptionForeground, #71717a)' : 'inherit',
            }}
          >
            <span style={{ marginRight: '6px' }}>
              {step.status === 'COMPLETED' ? '☑' : step.status === 'RUNNING' ? '►' : '☐'}
            </span>
            {step.description}
          </li>
        ))}
      </ul>
    </div>
  );
};
