import { WorkspaceDiscovery } from './workspace.js';
import { WorkspaceFile, FileClassification } from './types.js';

export class RepositoryMap {
  private _files: Map<string, WorkspaceFile> = new Map();
  private _isInitialized = false;

  constructor(private readonly discovery: WorkspaceDiscovery) {}

  public async initialize(): Promise<void> {
    const files = await this.discovery.enumerateFiles();
    this._files.clear();
    for (const file of files) {
      this._files.set(file.relativePath, file);
    }
    this._isInitialized = true;
  }

  public isInitialized(): boolean {
    return this._isInitialized;
  }

  public getAllFiles(): WorkspaceFile[] {
    return Array.from(this._files.values());
  }

  public getFile(relativePath: string): WorkspaceFile | undefined {
    return this._files.get(relativePath);
  }

  public getFilesByClassification(classification: FileClassification): WorkspaceFile[] {
    return this.getAllFiles().filter((f) => f.classification === classification);
  }

  public findFilesByName(pattern: string): WorkspaceFile[] {
    const lower = pattern.toLowerCase();
    return this.getAllFiles().filter((f) => {
      const base = f.relativePath.toLowerCase();
      return base.includes(lower);
    });
  }

  public markDirty(relativePathOrAbsolute: string): void {
    // Evict file from map so next query refreshes it
    for (const [relPath, file] of this._files.entries()) {
      if (
        relPath === relativePathOrAbsolute ||
        file.absolutePath === relativePathOrAbsolute ||
        relativePathOrAbsolute.endsWith(relPath)
      ) {
        this._files.delete(relPath);
        break;
      }
    }
  }

  public updateFile(file: WorkspaceFile): void {
    this._files.set(file.relativePath, file);
  }

  public async refresh(): Promise<void> {
    await this.initialize();
  }

  public clear(): void {
    this._files.clear();
    this._isInitialized = false;
  }

  public size(): number {
    return this._files.size;
  }
}
