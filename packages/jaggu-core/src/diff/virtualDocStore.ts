import { VirtualDocument, IVirtualDocStore } from '../types/diff.js';

export type { IVirtualDocStore };

export class InMemoryVirtualDocStore implements IVirtualDocStore {
  private readonly docs = new Map<string, VirtualDocument>();

  set(uri: string, originalContent: string, proposedContent: string): void {
    this.docs.set(uri, {
      uri,
      originalContent,
      proposedContent,
      createdAt: Date.now(),
    });
  }

  get(uri: string): VirtualDocument | undefined {
    return this.docs.get(uri);
  }

  has(uri: string): boolean {
    return this.docs.has(uri);
  }

  delete(uri: string): boolean {
    return this.docs.delete(uri);
  }

  clear(): void {
    this.docs.clear();
  }

  getAll(): VirtualDocument[] {
    return Array.from(this.docs.values());
  }
}
