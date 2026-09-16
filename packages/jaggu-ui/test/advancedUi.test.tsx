import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { FileMentionDropdown } from '../src/components/FileMentionDropdown.js';
import { AttachedFilesBar } from '../src/components/AttachedFilesBar.js';
import { ExecutionDrawer, LogEntry } from '../src/components/ExecutionDrawer.js';
import { App } from '../src/App.js';

describe('Advanced UI Features (Track 3)', () => {
  describe('FileMentionDropdown', () => {
    it('should render matching workspace files', () => {
      const files = ['packages/jaggu-core/src/index.ts', 'packages/jaggu-ui/src/App.tsx', 'README.md'];
      const html = renderToString(
        <FileMentionDropdown
          files={files}
          query="app"
          selectedIndex={0}
          onSelect={() => {}}
          onClose={() => {}}
        />,
      );

      expect(html).toContain('data-testid="file-mention-dropdown"');
      expect(html).toContain('App.tsx');
      expect(html).toContain('packages/jaggu-ui/src');
      expect(html).not.toContain('index.ts');
    });

    it('should return null when no files match query', () => {
      const files = ['README.md', 'package.json'];
      const html = renderToString(
        <FileMentionDropdown
          files={files}
          query="nonexistent"
          selectedIndex={0}
          onSelect={() => {}}
          onClose={() => {}}
        />,
      );

      expect(html).toBe('');
    });
  });

  describe('AttachedFilesBar', () => {
    it('should render file chips for attached files', () => {
      const files = ['src/index.ts', 'docs/guide.md'];
      const html = renderToString(
        <AttachedFilesBar files={files} onRemove={() => {}} onClearAll={() => {}} />,
      );

      expect(html).toContain('data-testid="attached-files-bar"');
      expect(html).toContain('data-testid="attached-file-chip-index.ts"');
      expect(html).toContain('data-testid="attached-file-chip-guide.md"');
      expect(html).toContain('Clear all');
    });

    it('should return null when files array is empty', () => {
      const html = renderToString(
        <AttachedFilesBar files={[]} onRemove={() => {}} onClearAll={() => {}} />,
      );

      expect(html).toBe('');
    });
  });

  describe('ExecutionDrawer', () => {
    const mockLogs: LogEntry[] = [
      { id: '1', type: 'info', line: 'Agent starting', timestamp: 1700000000000 },
      { id: '2', type: 'tool', line: 'Running ripgrep search', timestamp: 1700000001000 },
      { id: '3', type: 'stderr', line: 'Compile error on line 42', timestamp: 1700000002000 },
    ];

    it('should render collapsed drawer header with log count', () => {
      const html = renderToString(
        <ExecutionDrawer isOpen={false} logs={mockLogs} onToggle={() => {}} onClear={() => {}} />,
      );

      expect(html).toContain('data-testid="execution-drawer"');
      expect(html).toContain('Terminal / Execution');
      expect(html).toContain('3');
      expect(html).not.toContain('data-testid="terminal-content"');
    });

    it('should render open drawer with log lines and formatted type tags', () => {
      const html = renderToString(
        <ExecutionDrawer isOpen={true} logs={mockLogs} onToggle={() => {}} onClear={() => {}} />,
      );

      expect(html).toContain('data-testid="terminal-content"');
      expect(html).toContain('Agent starting');
      expect(html).toContain('Running ripgrep search');
      expect(html).toContain('Compile error on line 42');
      expect(html).toContain('[INFO]');
      expect(html).toContain('[TOOL]');
      expect(html).toContain('[STDERR]');
      expect(html).toContain('data-testid="clear-logs-btn"');
      expect(html).toContain('data-testid="copy-logs-btn"');
    });
  });

  describe('App integration of Advanced UI', () => {
    it('should render terminal toggle button and placeholder with @file hints', () => {
      const html = renderToString(<App initialStatus="IDLE" />);

      expect(html).toContain('data-testid="terminal-toggle-btn"');
      expect(html).toContain('Terminal');
      expect(html).toContain('Type @ to reference files');
      expect(html).toContain('data-testid="execution-drawer"');
    });
  });
});
