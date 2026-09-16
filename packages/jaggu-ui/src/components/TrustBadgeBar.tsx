import React from 'react';

export interface TrustBadgeBarProps {
  state?: string;
}

export const TrustBadgeBar: React.FC<TrustBadgeBarProps> = ({ state = 'IDLE' }) => {
  return (
    <div
      data-testid="trust-badge-bar"
      style={{
        display: 'none',
      }}
      aria-hidden="true"
    >
      <span>TRUSTED CONTROL ACTIVE</span>
      <span>Zero Silent Writes</span>
      <span>Review-Gated</span>
      <span>{state}</span>
    </div>
  );
};
