import React from 'react';

export interface AttachedFilesBarProps {
  files: string[];
  onRemove: (filePath: string) => void;
  onClearAll?: () => void;
}

export const AttachedFilesBar: React.FC<AttachedFilesBarProps> = ({
  files,
  onRemove,
  onClearAll,
}) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="attached-files-bar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 0',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        Context:
      </span>
      {files.map((file) => {
        const fileName = file.split('/').pop() || file;
        return (
          <div
            key={file}
            data-testid={`attached-file-chip-${fileName}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 7px',
              borderRadius: '4px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#93c5fd',
            }}
          >
            <span>📄</span>
            <span title={file} style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </span>
            <button
              type="button"
              onClick={() => onRemove(file)}
              title={`Remove ${fileName}`}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: '11px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
            >
              ✕
            </button>
          </div>
        );
      })}
      {files.length > 1 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            fontSize: '10px',
            textDecoration: 'underline',
            padding: '2px 4px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)')}
        >
          Clear all
        </button>
      )}
    </div>
  );
};
