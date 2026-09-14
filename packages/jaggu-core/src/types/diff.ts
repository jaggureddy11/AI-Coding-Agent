export interface VirtualDocument {
  readonly uri: string;
  readonly originalContent: string;
  proposedContent: string;
  readonly createdAt: number;
}

export interface IVirtualDocStore {
  set(uri: string, originalContent: string, proposedContent: string): void;
  get(uri: string): VirtualDocument | undefined;
  has(uri: string): boolean;
  delete(uri: string): boolean;
  clear(): void;
  getAll(): VirtualDocument[];
}
