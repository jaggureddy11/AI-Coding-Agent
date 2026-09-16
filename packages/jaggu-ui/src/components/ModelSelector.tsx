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
    (m) => m.access === 'paid' || (m.runtimeType === 'cloud' && m.access !== 'free'),
  );
  const mockModels = models.filter((m) => m.providerId === 'mock');

  let healthColor = '#4caf50';
  let healthTitle = 'Auto: JAGGU automatically selects the best free or local model';

  if (!isAuto && activeModel) {
    healthColor = getHealthColor(activeModel.health);
    healthTitle = `${getHealthLabel(activeModel.health)}${activeModel.healthDetail ? `: ${activeModel.healthDetail}` : ''}`;
  }

  let badgeText = 'AUTO';
  let badgeColor = 'var(--vscode-editorInfo-foreground, #75beff)';
  let badgeBg = 'var(--vscode-badge-background, rgba(0, 122, 204, 0.2))';

  if (!isAuto && activeModel) {
    if (activeModel.access === 'free') {
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
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'var(--vscode-input-background, #1e1e1e)',
          border: '1px solid var(--vscode-input-border, #3c3c3c)',
          borderRadius: '4px',
          padding: '2px 6px',
        }}
      >
        <span
          data-testid="model-health-dot"
          title={healthTitle}
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: healthColor,
            display: 'inline-block',
            cursor: 'help',
          }}
        />

        <select
          data-testid="model-selector"
          aria-label="Select AI Model"
          value={activeModelId || 'auto'}
          onChange={(e) => onSelectModel(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--vscode-input-foreground, #cccccc)',
            fontSize: '11px',
            outline: 'none',
            cursor: 'pointer',
            maxWidth: '180px',
          }}
        >
          <optgroup label="AUTO (RECOMMENDED)">
            <option value="auto">Auto (Best Available Free/Local)</option>
          </optgroup>

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
          data-testid="model-runtime-badge"
          style={{
            fontSize: '9px',
            padding: '1px 4px',
            borderRadius: '2px',
            fontWeight: 600,
            textTransform: 'uppercase',
            backgroundColor: badgeBg,
            color: badgeColor,
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
            color: 'var(--vscode-descriptionForeground, #858585)',
            cursor: 'pointer',
            padding: '2px',
            fontSize: '11px',
          }}
        >
          ↻
        </button>
      )}
    </div>
  );
};
