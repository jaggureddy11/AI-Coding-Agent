import React, { useEffect, useRef } from 'react';

export interface FileMentionDropdownProps {
  files: string[];
  query: string;
  selectedIndex: number;
  onSelect: (filePath: string) => void;
  onClose: () => void;
}

export const FileMentionDropdown: React.FC<FileMentionDropdownProps> = ({
  files,
  query,
  selectedIndex,
  onSelect,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filteredFiles = files
    .filter((f) => f.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (filteredFiles.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="file-mention-dropdown"
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '0',
        right: '0',
        marginBottom: '6px',
        backgroundColor: 'rgba(20, 20, 24, 0.98)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        zIndex: 50,
        overflow: 'hidden',
        maxHeight: '220px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'rgba(255, 255, 255, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Reference File ({filteredFiles.length})</span>
        <span style={{ fontSize: '9px', opacity: 0.7 }}>Tab / ↵ to insert</span>
      </div>
      <div style={{ overflowY: 'auto', padding: '4px' }}>
        {filteredFiles.map((file, idx) => {
          const isSelected = idx === selectedIndex;
          const fileName = file.split('/').pop() || file;
          const dirPath = file.includes('/') ? file.substring(0, file.lastIndexOf('/')) : '';

          return (
            <button
              key={file}
              data-testid={`file-mention-item-${idx}`}
              type="button"
              onClick={() => onSelect(file)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                textAlign: 'left',
                borderRadius: '5px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                fontSize: '11.5px',
                transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '11px', opacity: 0.6 }}>📄</span>
              <span style={{ fontWeight: 500, color: '#93c5fd' }}>{fileName}</span>
              {dirPath && (
                <span
                  style={{
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.35)',
                    marginLeft: 'auto',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '140px',
                  }}
                >
                  {dirPath}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
