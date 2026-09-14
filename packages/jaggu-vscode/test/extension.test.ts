import { describe, it, expect, vi } from 'vitest';

// Mock the host-provided 'vscode' module for unit testing
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

  return {
    EventEmitter,
    Uri: {
      parse: (str: string) => ({ toString: () => str, scheme: str.split(':')[0] }),
    },
  };
});

import { JagguShadowDocProvider } from '../src/virtualDocProvider.js';
import { InMemoryVirtualDocStore } from '@jaggu/core';

describe('JagguShadowDocProvider', () => {
  it('should return empty string for non-existent document', () => {
    const store = new InMemoryVirtualDocStore();
    const provider = new JagguShadowDocProvider(store);
    const mockUri = { toString: () => 'jaggu-shadow://unknown.ts' } as any;

    expect(provider.provideTextDocumentContent(mockUri)).toBe('');
  });

  it('should return proposedContent for staged virtual document', () => {
    const store = new InMemoryVirtualDocStore();
    store.set('jaggu-shadow://src/app.ts', 'const x = 1;', 'const x = 42;');

    const provider = new JagguShadowDocProvider(store);
    const mockUri = { toString: () => 'jaggu-shadow://src/app.ts' } as any;

    expect(provider.provideTextDocumentContent(mockUri)).toBe('const x = 42;');
  });

  it('should have correct scheme constant', () => {
    expect(JagguShadowDocProvider.SCHEME).toBe('jaggu-shadow');
  });

  it('should fire onDidChange event when notifyChanged is called', () => {
    const store = new InMemoryVirtualDocStore();
    const provider = new JagguShadowDocProvider(store);
    let eventFired = false;
    provider.onDidChange(() => {
      eventFired = true;
    });

    const mockUri = { toString: () => 'jaggu-shadow://src/app.ts' } as any;
    provider.notifyChanged(mockUri);
    expect(eventFired).toBe(true);
  });
});
