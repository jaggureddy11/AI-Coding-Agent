import { vi } from 'vitest';

vi.mock('vscode', () => {
  class EventEmitter<T> {
    private handlers: Array<(e: T) => any> = [];
    event = (listener: (e: T) => any) => {
      this.handlers.push(listener);
      return { dispose: () => {} };
    };
    fire(data: T) {
      this.handlers.forEach((h) => h(data));
    }
  }

  const registeredCommands: Record<string, Function> = {};
  let webviewProvider: any = null;
  let docProvider: any = null;

  return {
    EventEmitter,
    StatusBarAlignment: { Right: 2 },
    ThemeColor: class ThemeColor {
      constructor(public id: string) {}
    },
    Uri: {
      parse: (str: string) => ({ toString: () => str, scheme: str.split(':')[0] }),
      joinPath: (base: any, ...segments: string[]) => ({
        toString: () => `${base.toString()}/${segments.join('/')}`,
        fsPath: `${base.fsPath || ''}/${segments.join('/')}`,
      }),
    },
    workspace: {
      registerTextDocumentContentProvider: (scheme: string, provider: any) => {
        docProvider = { scheme, provider };
        return { dispose: () => {} };
      },
    },
    window: {
      registerWebviewViewProvider: (viewId: string, provider: any) => {
        webviewProvider = { viewId, provider };
        return { dispose: () => {} };
      },
      createStatusBarItem: (_alignment: any, _priority: number) => {
        return {
          text: '',
          tooltip: '',
          command: '',
          backgroundColor: undefined,
          show: vi.fn(),
          hide: vi.fn(),
          dispose: vi.fn(),
        };
      },
      showInformationMessage: vi.fn(),
    },
    commands: {
      registerCommand: (command: string, callback: Function) => {
        registeredCommands[command] = callback;
        return { dispose: () => {} };
      },
      executeCommand: vi.fn((cmd: string) => Promise.resolve(cmd)),
      __getRegisteredCommands: () => registeredCommands,
      __getWebviewProvider: () => webviewProvider,
      __getDocProvider: () => docProvider,
    },
  };
});
