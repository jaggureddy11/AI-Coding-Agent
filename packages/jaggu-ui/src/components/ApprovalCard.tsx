import React from 'react';

export interface ApprovalCardProps {
  proposalId: string;
  filePath: string;
  diffSummary: string;
  onReviewDiff: (filePath: string) => void;
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
  status?: 'pending' | 'approved' | 'rejected';
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  proposalId,
  filePath,
  diffSummary,
  onReviewDiff,
  onApprove,
  onReject,
  status = 'pending',
}) => {
  return (
    <div
      data-testid="approval-card"
      style={{
        margin: '10px 0',
        padding: '12px 14px',
        borderRadius: '6px',
        border: '1px solid var(--vscode-editorWarning-foreground, #cca700)',
        backgroundColor: 'var(--vscode-sideBar-background, #252526)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '15px' }}>⚡</span>
        <span
          style={{
            fontWeight: 600,
            fontSize: '13px',
            color: 'var(--vscode-foreground, #ffffff)',
          }}
        >
          Proposed Workspace Edit
        </span>
        {status === 'approved' && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--vscode-testing-iconPassed, #89d185)',
              backgroundColor: 'rgba(137, 209, 133, 0.15)',
              padding: '2px 6px',
              borderRadius: '3px',
            }}
          >
            APPROVED
          </span>
        )}
        {status === 'rejected' && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--vscode-errorForeground, #f48771)',
              backgroundColor: 'rgba(244, 135, 113, 0.15)',
              padding: '2px 6px',
              borderRadius: '3px',
            }}
          >
            REJECTED
          </span>
        )}
      </div>

      <div
        style={{
          fontFamily: 'var(--vscode-editor-font-family, monospace)',
          fontSize: '12px',
          padding: '6px 8px',
          backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
          borderRadius: '4px',
          border: '1px solid var(--vscode-widget-border, #333333)',
          marginBottom: '8px',
          wordBreak: 'break-all',
        }}
      >
        📄 {filePath}
      </div>

      <div
        style={{
          fontSize: '11px',
          color: 'var(--vscode-descriptionForeground, #888888)',
          marginBottom: '10px',
        }}
      >
        {diffSummary}
      </div>

      {status === 'pending' ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onReviewDiff(filePath)}
            style={{
              background: 'transparent',
              border: '1px solid var(--vscode-button-border, #007acc)',
              color: 'var(--vscode-textLink-foreground, #3794ff)',
              padding: '4px 10px',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            🔍 Review Changes
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => onApprove(proposalId)}
              style={{
                backgroundColor: 'var(--vscode-button-background, #0e639c)',
                color: 'var(--vscode-button-foreground, #ffffff)',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => onReject(proposalId)}
              style={{
                backgroundColor: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                color: 'var(--vscode-button-secondaryForeground, #cccccc)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex' }}>
          <button
            type="button"
            onClick={() => onReviewDiff(filePath)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--vscode-textLink-foreground, #3794ff)',
              padding: 0,
              fontSize: '11px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            View Diff
          </button>
        </div>
      )}
    </div>
  );
};
