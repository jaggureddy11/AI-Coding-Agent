import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Silently capture or forward to host
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          data-testid="ui-error-boundary-fallback"
          style={{
            padding: '12px',
            margin: '8px',
            backgroundColor: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
            border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
            borderRadius: '4px',
            color: 'var(--vscode-inputValidation-errorForeground, #ffffff)',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            {this.props.fallbackTitle || 'Component rendering error occurred'}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '8px' }}>
            {this.state.error?.message || 'Unexpected view exception.'}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: '4px 8px',
              backgroundColor: 'var(--vscode-button-background, #0e639c)',
              color: 'var(--vscode-button-foreground, #ffffff)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Retry View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
