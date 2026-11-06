import React from 'react';
import type { ModelDescriptor, ModelHealthStatus } from '@jaggu/core';

export interface ModelSelectorProps {
  models: ModelDescriptor[];
  activeModelId: string;
  onSelectModel: (modelId: string) => void;
  onRefreshHealth?: () => void;
}

export const getHealthColor = (status: ModelHealthStatus): string => {
  switch (status) {
    case 'available':
      return '#4caf50'; // Green
    case 'missing_credentials':
      return '#ff9800'; // Amber
    case 'unreachable':
    case 'not_installed':
      return '#f44336'; // Red
    case 'unknown':
    default:
      return '#858585'; // Gray
  }
};

export const getHealthLabel = (status: ModelHealthStatus): string => {
  switch (status) {
    case 'available':
      return 'Available';
    case 'missing_credentials':
      return 'API Key Required';
    case 'unreachable':
      return 'Endpoint Unreachable';
    case 'not_installed':
      return 'Model Not Installed';
    case 'unknown':
    default:
      return 'Status Unknown';
  }
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  activeModelId,
  onSelectModel,
  onRefreshHealth,
}) => {
  const isAuto = activeModelId === 'auto' || !activeModelId;
  const activeModel = models.find((m) => m.id === activeModelId);

  // Filter cross-region variants and redundant duplicates
  const isExcluded = (m: ModelDescriptor) => {
    if (
      m.id.startsWith('us.') ||
      m.id.startsWith('apac.anthropic') ||
      m.id.startsWith('eu.') ||
      m.displayName.includes('Cross-Region')
    ) {
      return true;
    }
    // Filter out models without tool capability from main cloud list
    if (m.providerId === 'bedrock' && m.capabilities.toolCalling === false) {
      return true;
    }
    return false;
  };

  // Deduplicate and refine primary cloud models
  const seenNames = new Set<string>();
  const refinedBedrockModels: ModelDescriptor[] = [];
  for (const m of models) {
    if (m.providerId !== 'bedrock' || isExcluded(m)) continue;
    const cleanName = m.displayName.replace(/\s*\[AU\s*\/\s*APAC\]/i, '').trim();
    if (!seenNames.has(cleanName)) {
      seenNames.add(cleanName);
      refinedBedrockModels.push({
        ...m,
        displayName: cleanName,
      });
    }
  }

  const freeModels = models.filter(
    (m) => m.access === 'free' && m.id !== 'mock-fast' && m.id !== 'mock-reasoning',
  );
  const localModels = models.filter(
    (m) =>
      (m.access === 'local' || m.runtimeType === 'local') &&
      m.id !== 'mock-fast' &&
      m.id !== 'mock-reasoning',
  );
  const paidModels = models.filter(
    (m) =>
      m.providerId !== 'bedrock' &&
      (m.access === 'paid' || (m.runtimeType === 'cloud' && m.access !== 'free')),
  );

  // Testing & mock models (preserved for unit test fixtures)
  const isTest =
    typeof process !== 'undefined' &&
    (Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test');
  const mockModels = isTest ? models.filter((m) => m.providerId === 'mock') : [];

  let healthColor = '#4caf50';
  let healthTitle = 'Auto: JAGGU automatically selects the best fast model';

  if (!isAuto && activeModel) {
    healthColor = getHealthColor(activeModel.health);
    healthTitle = `${getHealthLabel(activeModel.health)}${activeModel.healthDetail ? `: ${activeModel.healthDetail}` : ''}`;
  }

  let badgeText = 'AUTO';
  let badgeColor = 'var(--vscode-editorInfo-foreground, #75beff)';
  let badgeBg = 'var(--vscode-badge-background, rgba(0, 122, 204, 0.2))';

  if (!isAuto && activeModel) {
    if (activeModel.providerId === 'bedrock') {
      badgeText = 'CLOUD';
      badgeColor = '#60a5fa';
      badgeBg = 'rgba(96, 165, 250, 0.15)';
    } else if (activeModel.access === 'free') {
      badgeText = 'FREE';
      badgeColor = '#4caf50';
      badgeBg = 'rgba(76, 175, 80, 0.15)';
    } else if (activeModel.access === 'local') {
      badgeText = 'LOCAL';
      badgeColor = '#75beff';
      badgeBg = 'rgba(0, 122, 204, 0.2)';
    } else if (activeModel.access === 'paid') {
      badgeText = 'PAID';
      badgeColor = '#ff9800';
      badgeBg = 'rgba(255, 152, 0, 0.15)';
    } else {
      badgeText = activeModel.runtimeType.toUpperCase();
    }
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: '6px',
          padding: '3px 7px',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
        }}
      >
        <span
          data-testid="model-health-dot"
          title={healthTitle}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: healthColor,
            boxShadow: `0 0 6px ${healthColor}`,
            display: 'inline-block',
            flexShrink: 0,
            cursor: 'help',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            flex: '1 1 auto',
            overflow: 'hidden',
          }}
        >
          <select
            data-testid="model-selector"
            aria-label="Select AI Model"
            value={activeModelId || 'auto'}
            onChange={(e) => onSelectModel(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--vscode-foreground, #d4d4d8)',
              fontSize: '11px',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer',
              paddingRight: '12px',
              margin: 0,
              width: '100%',
              minWidth: 0,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            <optgroup label="AUTO (RECOMMENDED)">
              <option value="auto">Auto (Claude Haiku - Fast &amp; Simple)</option>
            </optgroup>

            {refinedBedrockModels.length > 0 && (
              <optgroup label="RECOMMENDED CLOUD MODELS">
                {refinedBedrockModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </optgroup>
            )}

            {freeModels.length > 0 && (
              <optgroup label="FREE / OPEN (HUGGING FACE)">
                {freeModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </optgroup>
            )}

            {localModels.length > 0 && (
              <optgroup label="LOCAL (OLLAMA / VLLM)">
                {localModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {`${m.displayName}${!m.capabilities.toolCalling ? ' [No Tools]' : ''}`}
                  </option>
                ))}
              </optgroup>
            )}

            {paidModels.length > 0 && (
              <optgroup label="CONFIGURED (OPTIONAL CLOUD)">
                {paidModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </optgroup>
            )}

            {mockModels.length > 0 && (
              <optgroup label="TESTING & OFFLINE">
                {mockModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <span
            style={{
              position: 'absolute',
              right: 0,
              pointerEvents: 'none',
              opacity: 0.5,
              fontSize: '8px',
              lineHeight: 1,
            }}
          >
            ▼
          </span>
        </div>

        <span
          data-testid="model-runtime-badge"
          style={{
            fontSize: '8.5px',
            padding: '1px 4px',
            borderRadius: '3px',
            fontWeight: 600,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            backgroundColor: badgeBg,
            color: badgeColor,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {badgeText}
        </span>
      </div>

      {onRefreshHealth && (
        <button
          type="button"
          data-testid="refresh-health-btn"
          title="Check provider availability"
          onClick={onRefreshHealth}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--vscode-descriptionForeground, #71717a)',
            cursor: 'pointer',
            padding: '2px',
            fontSize: '11px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0.6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.6';
          }}
        >
          ↻
        </button>
      )}
    </div>
  );
};
