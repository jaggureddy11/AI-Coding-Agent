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
  const activeModel = models.find((m) => m.id === activeModelId);

  const localModels = models.filter((m) => m.runtimeType === 'local');
  const cloudModels = models.filter((m) => m.runtimeType === 'cloud');

  const healthColor = activeModel ? getHealthColor(activeModel.health) : '#858585';
  const healthTitle = activeModel
    ? `${getHealthLabel(activeModel.health)}${activeModel.healthDetail ? `: ${activeModel.healthDetail}` : ''}`
    : 'Unknown model';

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
          value={activeModelId}
          onChange={(e) => onSelectModel(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--vscode-input-foreground, #cccccc)',
            fontSize: '11px',
            outline: 'none',
            cursor: 'pointer',
            maxWidth: '160px',
          }}
        >
          {localModels.length > 0 && (
            <optgroup label="Local Models">
              {localModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {`${m.displayName}${!m.capabilities.toolCalling ? ' [No Tools]' : ''}`}
                </option>
              ))}
            </optgroup>
          )}

          {cloudModels.length > 0 && (
            <optgroup label="Cloud Models">
              {cloudModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </optgroup>
          )}

          {localModels.length === 0 && cloudModels.length === 0 && (
            <option value={activeModelId}>{activeModelId || 'Default Model'}</option>
          )}
        </select>

        {activeModel && (
          <span
            data-testid="model-runtime-badge"
            style={{
              fontSize: '9px',
              padding: '1px 4px',
              borderRadius: '2px',
              fontWeight: 600,
              textTransform: 'uppercase',
              backgroundColor:
                activeModel.runtimeType === 'local'
                  ? 'var(--vscode-badge-background, rgba(0, 122, 204, 0.2))'
                  : 'var(--vscode-badge-background, rgba(255, 255, 255, 0.1))',
              color:
                activeModel.runtimeType === 'local'
                  ? 'var(--vscode-editorInfo-foreground, #75beff)'
                  : 'var(--vscode-badge-foreground, #cccccc)',
            }}
          >
            {activeModel.runtimeType}
          </span>
        )}
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
