import React from 'react';
import { AgentState } from '@jaggu/core';

interface StatusPillProps {
  state: AgentState;
}

export const StatusPill: React.FC<StatusPillProps> = ({ state }) => {
  const getBadgeStyle = (): React.CSSProperties => {
    switch (state) {
      case AgentState.IDLE:
        return { backgroundColor: 'var(--vscode-badge-background, #3c3c3c)', color: 'var(--vscode-badge-foreground, #ffffff)' };
      case AgentState.THINKING:
      case AgentState.PLANNING:
        return { backgroundColor: 'var(--vscode-activityBarBadge-background, #007acc)', color: '#ffffff' };
      case AgentState.WAITING_FOR_APPROVAL:
        return { backgroundColor: '#d97706', color: '#ffffff' };
      case AgentState.EXECUTING:
      case AgentState.VERIFYING:
        return { backgroundColor: '#2563eb', color: '#ffffff' };
      case AgentState.COMPLETED:
        return { backgroundColor: '#16a34a', color: '#ffffff' };
      case AgentState.FAILED:
      case AgentState.CANCELLED:
        return { backgroundColor: 'var(--vscode-errorForeground, #f87171)', color: '#ffffff' };
    }
  };

  return (
    <span
      data-testid="status-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        ...getBadgeStyle(),
      }}
    >
      {state}
    </span>
  );
};
