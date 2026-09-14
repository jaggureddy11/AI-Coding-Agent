import React from 'react';

export interface ApprovalFileItem {
  relativePath: string;
  shadowUri?: string;
  isNew?: boolean;
}

export interface ApprovalCardProps {
  proposalId: string;
  filePath?: string;
  files?: ApprovalFileItem[];
  diffSummary?: string;
  onReviewDiff: (filePath: string) => void;
  onApprove: (proposalId: string, approvedFiles?: string[]) => void;
  onReject: (proposalId: string) => void;
  status?: 'pending' | 'approved' | 'rejected';
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  proposalId,
  filePath,
  files,
  diffSummary,
  onReviewDiff,
  onApprove,
  onReject,
  status = 'pending',
}) => {
  const fileList = files && files.length > 0 ? files : filePath ? [{ relativePath: filePath }] : [];
  const primaryPath = filePath || (fileList[0]?.relativePath ?? '');

  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(
    () => new Set(fileList.map((f) => f.relativePath)),
  );

  React.useEffect(() => {
    setSelectedFiles(new Set(fileList.map((f) => f.relativePath)));
  }, [files, filePath]);

  const toggleFile = (relPath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) {
        next.delete(relPath);
      } else {
        next.add(relPath);
      }
      return next;
    });
  };

  const isAllSelected = selectedFiles.size === fileList.length;
  const isNoneSelected = selectedFiles.size === 0;

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
          {fileList.length > 1
            ? `JAGGU Proposes Changes to ${fileList.length} Files`
            : 'Proposed Workspace Edit'}
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
        {fileList.map((item) => {
          const isSelected = selectedFiles.has(item.relativePath);
          return (
            <div
              key={item.relativePath}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 8px',
                backgroundColor: isSelected
                  ? 'var(--vscode-editor-background, #1e1e1e)'
                  : 'rgba(255, 255, 255, 0.03)',
                borderRadius: '4px',
                border: isSelected
                  ? '1px solid var(--vscode-widget-border, #333333)'
                  : '1px dashed rgba(255, 255, 255, 0.15)',
                fontSize: '12px',
                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                opacity: status === 'pending' && !isSelected ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                {status === 'pending' && fileList.length > 1 && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFile(item.relativePath)}
                    title={`Select ${item.relativePath} for approval`}
                    style={{ cursor: 'pointer' }}
                  />
                )}
                <span style={{ wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  📄 {item.relativePath}
                  {item.isNew && (
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--vscode-charts-green, #89d185)',
                        border: '1px solid rgba(137, 209, 133, 0.3)',
                        padding: '0 4px',
                        borderRadius: '3px',
                      }}
                    >
                      NEW
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onReviewDiff(item.relativePath)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--vscode-textLink-foreground, #3794ff)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '2px 6px',
                  textDecoration: 'underline',
                  flexShrink: 0,
                }}
              >
                Review Diff
              </button>
            </div>
          );
        })}
      </div>

      {diffSummary && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--vscode-descriptionForeground, #888888)',
            marginBottom: '10px',
          }}
        >
          {diffSummary}
        </div>
      )}

      {status === 'pending' ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {primaryPath && (
            <button
              type="button"
              onClick={() => onReviewDiff(primaryPath)}
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
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              disabled={isNoneSelected}
              onClick={() => onApprove(proposalId, Array.from(selectedFiles))}
              style={{
                backgroundColor: isNoneSelected
                  ? 'var(--vscode-button-secondaryBackground, #3a3d41)'
                  : 'var(--vscode-button-background, #0e639c)',
                color: 'var(--vscode-button-foreground, #ffffff)',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: isNoneSelected ? 'not-allowed' : 'pointer',
                opacity: isNoneSelected ? 0.5 : 1,
              }}
            >
              {fileList.length > 1 && !isAllSelected && !isNoneSelected
                ? `Approve Selected (${selectedFiles.size})`
                : 'Approve Changes'}
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
          {primaryPath && (
            <button
              type="button"
              onClick={() => onReviewDiff(primaryPath)}
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
          )}
        </div>
      )}
    </div>
  );
};
