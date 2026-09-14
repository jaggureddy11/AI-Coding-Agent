import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { VsCodeApi } from './types/rpc.js';

declare function acquireVsCodeApi(): VsCodeApi;

const getVsCodeApi = (): VsCodeApi | undefined => {
  if (typeof acquireVsCodeApi === 'function') {
    try {
      return acquireVsCodeApi();
    } catch {
      // Already acquired or unavailable
      return undefined;
    }
  }
  return undefined;
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const vscodeApi = getVsCodeApi();
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App vscode={vscodeApi} />
    </React.StrictMode>,
  );
}
