import React, { useRef, useEffect } from 'react';

export interface LogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'info' | 'tool';
  line: string;
  timestamp: number;
}

export interface ExecutionDrawerProps {
  isOpen: boolean;
  logs: LogEntry[];
  onToggle: () => void;
  onClear: () => void;
}

export const ExecutionDrawer: React.FC<ExecutionDrawerProps> = ({
  isOpen,
  logs,
  onToggle,
  onClear,
}) => {
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, logs]);

  const handleCopyLogs = () => {
    const raw = logs
      .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.type.toUpperCase()}] ${l.line}`)
      .join('\n');
    navigator.clipboard.writeText(raw);
  };

  return (
    <div
      data-testid="execution-drawer"
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(10, 10, 12, 0.98)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'height 0.2s ease',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderBottom: isOpen ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#60a5fa' }}>&gt;_</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)', letterSpacing: '0.02em' }}>
            Terminal / Execution
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '10px',
              backgroundColor: logs.length > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.06)',
              color: logs.length > 0 ? '#93c5fd' : 'rgba(255, 255, 255, 0.4)',
              fontFamily: 'monospace',
            }}
          >
            {logs.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOpen && (
            <>
              <button
                type="button"
                data-testid="clear-logs-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                title="Clear execution log"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
              >
                Clear
              </button>
              <button
                type="button"
                data-testid="copy-logs-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLogs();
                }}
                title="Copy all logs"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
              >
                Copy
              </button>
            </>
          )}
          <button
            type="button"
            data-testid="toggle-drawer-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '0 4px',
            }}
          >
            {isOpen ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Drawer content */}
      {isOpen && (
        <div
          data-testid="terminal-content"
          style={{
            height: '160px',
            overflowY: 'auto',
            padding: '8px 12px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '11px',
            lineHeight: 1.5,
            backgroundColor: '#070709',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {logs.length === 0 ? (
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.3)',
                fontStyle: 'italic',
                padding: '12px 0',
                textAlign: 'center',
              }}
            >
              No active execution output. Tool calls, test outputs, and diagnostic traces stream here.
            </div>
          ) : (
            logs.map((log) => {
              let tagColor = '#94a3b8';
              let textColor = '#e2e8f0';

              if (log.type === 'stderr') {
                tagColor = '#f87171';
                textColor = '#fca5a5';
              } else if (log.type === 'tool') {
                tagColor = '#60a5fa';
                textColor = '#93c5fd';
              } else if (log.type === 'info') {
                tagColor = '#34d399';
                textColor = '#6ee7b7';
              }

              return (
                <div key={log.id} style={{ display: 'flex', gap: '8px', wordBreak: 'break-all' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.3)', flexShrink: 0, fontSize: '10px' }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span
                    style={{
                      color: tagColor,
                      fontSize: '9.5px',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      fontWeight: 600,
                    }}
                  >
                    {`[${log.type.toUpperCase()}]`}
                  </span>
                  <span style={{ color: textColor, whiteSpace: 'pre-wrap' }}>{log.line}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      )}
    </div>
  );
};
