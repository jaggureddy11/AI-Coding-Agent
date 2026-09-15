import React, { useState } from 'react';

export interface TrustBadgeBarProps {
  state?: string;
}

export const TrustBadgeBar: React.FC<TrustBadgeBarProps> = ({ state = 'IDLE' }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid="trust-badge-bar"
      style={{
        padding: '6px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontSize: '11px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded((prev) => !prev)}
        title="Click to toggle security and verification guarantees"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Shield SVG */}
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ fontWeight: 600, color: '#34d399', letterSpacing: '0.02em' }}>
            TRUSTED CONTROL ACTIVE
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px' }}>•</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '10.5px' }}>
            Zero Silent Writes
          </span>
          <span
            style={{
              marginLeft: '4px',
              padding: '1px 5px',
              borderRadius: '3px',
              fontSize: '9.5px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              backgroundColor: state === 'IDLE' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(96, 165, 250, 0.15)',
              color: state === 'IDLE' ? '#34d399' : '#60a5fa',
              border: `1px solid ${state === 'IDLE' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(96, 165, 250, 0.3)'}`,
            }}
          >
            {state}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255, 255, 255, 0.45)', fontSize: '10px' }}>
          <span>{expanded ? 'Hide info ▲' : 'Guarantees ▼'}</span>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '6px',
            marginTop: '4px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255, 255, 255, 0.85)' }}>
            <span style={{ color: '#60a5fa' }}>🪟</span>
            <span><strong>In-Memory Staging:</strong> Diffs stage in a shadow buffer before touching disk.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255, 255, 255, 0.85)' }}>
            <span style={{ color: '#fbbf24' }}>📋</span>
            <span><strong>Approval Gates:</strong> Milestone PlanCards and file edits require explicit consent.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255, 255, 255, 0.85)' }}>
            <span style={{ color: '#a78bfa' }}>🔄</span>
            <span><strong>Empirical Proof:</strong> Test suites & LSP compiler diagnostics verify fixes.</span>
          </div>
        </div>
      )}
    </div>
  );
};
