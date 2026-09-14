import React from 'react';
import { AgentState, UiAgentStatus } from '@jaggu/core';

export interface StatusPillProps {
  state: UiAgentStatus | AgentState;
}

export const StatusPill: React.FC<StatusPillProps> = ({ state }) => {
  // Normalize to UiAgentStatus
  let normalizedStatus: UiAgentStatus;
  if (state in AgentState) {
    switch (state as AgentState) {
      case AgentState.IDLE:
        normalizedStatus = 'IDLE';
        break;
      case AgentState.COMPLETED:
        normalizedStatus = 'SUCCESS';
        break;
      case AgentState.FAILED:
        normalizedStatus = 'ERROR';
        break;
      case AgentState.CANCELLED:
        normalizedStatus = 'CANCELLED';
        break;
      default:
        normalizedStatus = 'PROCESSING';
        break;
    }
  } else {
    normalizedStatus = state as UiAgentStatus;
  }

  const getStatusConfig = () => {
    switch (normalizedStatus) {
      case 'IDLE':
        return {
          label: 'Ready',
          dotColor: 'var(--vscode-charts-green, #4ec9b0)',
          bg: 'var(--vscode-badge-background, rgba(255, 255, 255, 0.08))',
          fg: 'var(--vscode-badge-foreground, #cccccc)',
        };
      case 'PROCESSING':
        return {
          label: 'Processing',
          dotColor: 'var(--vscode-progressBar-background, #007acc)',
          bg: 'rgba(0, 122, 204, 0.18)',
          fg: 'var(--vscode-foreground, #ffffff)',
          pulsing: true,
        };
      case 'SUCCESS':
        return {
          label: 'Success',
          dotColor: 'var(--vscode-testing-iconPassed, #89d185)',
          bg: 'rgba(137, 209, 133, 0.18)',
          fg: 'var(--vscode-testing-iconPassed, #89d185)',
        };
      case 'ERROR':
        return {
          label: 'Error',
          dotColor: 'var(--vscode-errorForeground, #f48771)',
          bg: 'rgba(244, 135, 113, 0.18)',
          fg: 'var(--vscode-errorForeground, #f48771)',
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          dotColor: 'var(--vscode-descriptionForeground, #858585)',
          bg: 'rgba(133, 133, 133, 0.18)',
          fg: 'var(--vscode-descriptionForeground, #858585)',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      data-testid="status-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: config.bg,
        color: config.fg,
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <span
        data-testid="status-dot"
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: config.dotColor,
          display: 'inline-block',
          animation: config.pulsing ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      <span>{config.label}</span>
    </span>
  );
};
