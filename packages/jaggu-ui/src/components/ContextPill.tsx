import React, { useState } from 'react';
import type { ContextSnippetSummary } from '@jaggu/core';

export interface ContextPillProps {
  provenance: ContextSnippetSummary[];
}

export const ContextPill: React.FC<ContextPillProps> = ({ provenance }) => {
  const [expanded, setExpanded] = useState(false);

  if (!provenance || provenance.length === 0) {
    return null;
  }

  const uniqueFiles = Array.from(new Set(provenance.map((p) => p.relativeFilePath)));
  const totalBytes = provenance.reduce((sum, p) => sum + p.byteSize, 0);
  const sizeKb = (totalBytes / 1024).toFixed(1);

  const formatReason = (reason: string): string => {
    switch (reason) {
      case 'active_selection':
        return 'Selection';
      case 'active_file':
        return 'Active File';
      case 'explicit_reference':
        return 'Reference';
      case 'filename_match':
        return 'File Match';
      case 'text_search_match':
        return 'Search Match';
      case 'test_pairing':
        return 'Test Pairing';
      default:
        return reason;
    }
  };

  return (
    <div
      data-testid="context-pill"
      style={{
        marginTop: '6px',
        maxWidth: '90%',
        fontSize: '11px',
        backgroundColor: 'var(--vscode-editor-background, rgba(0, 0, 0, 0.2))',
        border: '1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1))',
        borderRadius: '4px',
        padding: '4px 8px',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          color: 'var(--vscode-descriptionForeground, #858585)',
        }}
      >
        <span>
          📎 Context:{' '}
          <strong>
            {uniqueFiles.length} {uniqueFiles.length === 1 ? 'file' : 'files'}
          </strong>{' '}
          ({sizeKb} KB)
        </span>
        <span style={{ fontSize: '10px', marginLeft: '8px' }}>
          {expanded ? 'Hide ▲' : 'Show details ▼'}
        </span>
      </div>

      {expanded && (
        <div
          data-testid="context-details"
          style={{
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px dashed var(--vscode-widget-border, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {provenance.map((item, idx) => (
            <div
              key={`${item.relativeFilePath}_${item.startLine}_${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2px 4px',
                borderRadius: '3px',
                backgroundColor: 'var(--vscode-input-background, rgba(255, 255, 255, 0.03))',
                fontSize: '10px',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--vscode-editor-font-family, monospace)',
                    color: 'var(--vscode-foreground, #cccccc)',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.relativeFilePath}
                >
                  {item.relativeFilePath}
                </span>
                <span style={{ color: 'var(--vscode-descriptionForeground, #858585)' }}>
                  L{item.startLine}–{item.endLine}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                  style={{
                    padding: '1px 4px',
                    borderRadius: '2px',
                    fontSize: '9px',
                    backgroundColor: 'var(--vscode-badge-background, rgba(255, 255, 255, 0.08))',
                    color: 'var(--vscode-badge-foreground, #858585)',
                  }}
                >
                  {formatReason(item.reason)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
