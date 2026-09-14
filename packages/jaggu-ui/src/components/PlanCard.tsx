import React from 'react';

export interface PlanStepItem {
  id: string;
  description: string;
  files: string[];
}

export interface LegacyPlanStep {
  id?: string;
  stepIndex?: number;
  description?: string;
  files?: string[];
  targetFiles?: string[];
}

export interface LegacyPlan {
  id?: string;
  goal?: string;
  title?: string;
  steps?: LegacyPlanStep[];
  risks?: string[];
  verification?: string[];
}

export interface PlanCardProps {
  plan?: LegacyPlan;
  planId?: string;
  goal?: string;
  steps?: PlanStepItem[];
  risks?: string[];
  verification?: string[];
  onApprove?: (planId: string) => void;
  onReject?: (planId: string) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  planId,
  goal,
  steps,
  risks = [],
  verification = [],
  onApprove,
  onReject,
}) => {
  const actualPlanId = planId || plan?.id || 'plan_default';
  const actualGoal = goal || plan?.goal || plan?.title || 'Engineering Plan';
  const rawSteps = steps || plan?.steps || [];
  const actualSteps: PlanStepItem[] = rawSteps.map((s: LegacyPlanStep, idx: number) => ({
    id: s.id || `step_${s.stepIndex || idx + 1}`,
    description: s.description || '',
    files: s.files || s.targetFiles || [],
  }));
  const actualRisks: string[] = risks.length > 0 ? risks : (plan?.risks || []);
  const actualVerification: string[] = verification.length > 0 ? verification : (plan?.verification || []);
  return (
    <div
      style={{
        backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
        border: '1px solid var(--vscode-editorWidget-border, #454545)',
        borderLeft: '3px solid var(--vscode-charts-blue, #3794ff)',
        borderRadius: '6px',
        padding: '12px 14px',
        margin: '10px 0',
        color: 'var(--vscode-foreground, #cccccc)',
        fontSize: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>📋</span>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--vscode-editor-foreground, #ffffff)' }}>
            Engineering Plan
          </span>
        </div>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--vscode-descriptionForeground, #888888)',
            backgroundColor: 'var(--vscode-badge-background, #333333)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          {actualSteps.length} {actualSteps.length === 1 ? 'step' : 'steps'}
        </span>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontWeight: 500, color: 'var(--vscode-textPreformat-foreground, #dcdcaa)', marginBottom: '3px' }}>
          GOAL
        </div>
        <div style={{ lineHeight: '1.4' }}>{actualGoal}</div>
      </div>

      {actualSteps.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 500, color: 'var(--vscode-textPreformat-foreground, #dcdcaa)', marginBottom: '4px' }}>
            STEPS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {actualSteps.map((step) => (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  padding: '4px 6px',
                  backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
                  borderRadius: '4px',
                  border: '1px solid var(--vscode-widget-border, #333333)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--vscode-charts-blue, #3794ff)', fontWeight: 600 }}>☐</span>
                  <span style={{ fontWeight: 500 }}>{step.description}</span>
                </div>
                {step.files.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginLeft: '16px' }}>
                    {step.files.map((file) => (
                      <span
                        key={file}
                        style={{
                          fontSize: '10px',
                          color: 'var(--vscode-textLink-foreground, #4fc1ff)',
                          backgroundColor: 'var(--vscode-badge-background, #2a2d2e)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {actualRisks.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 500, color: 'var(--vscode-editorWarning-foreground, #cca700)', marginBottom: '2px' }}>
            POTENTIAL RISKS
          </div>
          <ul style={{ margin: '0', paddingLeft: '18px', lineHeight: '1.4' }}>
            {actualRisks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {actualVerification.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 500, color: 'var(--vscode-charts-green, #89d185)', marginBottom: '2px' }}>
            VERIFICATION STRATEGY
          </div>
          <ul style={{ margin: '0', paddingLeft: '18px', lineHeight: '1.4' }}>
            {actualVerification.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <button
          onClick={() => onApprove?.(actualPlanId)}
          style={{
            flex: 1,
            padding: '6px 12px',
            backgroundColor: 'var(--vscode-button-background, #0e639c)',
            color: 'var(--vscode-button-foreground, #ffffff)',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '11px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground, #1177bb)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--vscode-button-background, #0e639c)')}
        >
          ✓ Approve Plan
        </button>
        <button
          onClick={() => onReject?.(actualPlanId)}
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--vscode-button-secondaryBackground, #3a3d41)',
            color: 'var(--vscode-button-secondaryForeground, #ffffff)',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 500,
            cursor: 'pointer',
            fontSize: '11px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground, #45494e)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground, #3a3d41)')}
        >
          Reject Plan
        </button>
      </div>
    </div>
  );
};
