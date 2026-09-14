import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  resolveAndValidateWorkspacePath,
  WorkspaceSecurityError,
} from '../src/tools/security.js';

describe('Workspace Path Security & Containment Validation', () => {
  let tmpWorkspace: string;
  let outsideDir: string;

  beforeEach(() => {
    tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-sec-workspace-'));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-sec-outside-'));

    fs.mkdirSync(path.join(tmpWorkspace, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(tmpWorkspace, 'src', 'auth', 'login.ts'), 'export const login = 1;');
    fs.writeFileSync(path.join(outsideDir, 'secret.env'), 'API_SECRET=12345');
  });

  afterEach(() => {
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('should allow valid relative paths inside the workspace', () => {
    const resolved = resolveAndValidateWorkspacePath('src/auth/login.ts', [tmpWorkspace]);
    expect(resolved).toBe(path.resolve(tmpWorkspace, 'src/auth/login.ts'));
  });

  it('should allow valid absolute paths that reside within workspace root', () => {
    const absPath = path.join(tmpWorkspace, 'src', 'auth', 'login.ts');
    const resolved = resolveAndValidateWorkspacePath(absPath, [tmpWorkspace]);
    expect(resolved).toBe(absPath);
  });

  it('should allow paths for files that do not exist yet but are within workspace', () => {
    const newFilePath = 'src/auth/newEndpoint.ts';
    const resolved = resolveAndValidateWorkspacePath(newFilePath, [tmpWorkspace]);
    expect(resolved).toBe(path.resolve(tmpWorkspace, newFilePath));
  });

  it('should strictly reject directory traversal ../ attempts', () => {
    expect(() => {
      resolveAndValidateWorkspacePath('../../etc/passwd', [tmpWorkspace]);
    }).toThrowError(WorkspaceSecurityError);

    try {
      resolveAndValidateWorkspacePath('../outside.ts', [tmpWorkspace]);
    } catch (err: any) {
      expect(err.code).toBe('PATH_TRAVERSAL_DETECTED');
    }
  });

  it('should strictly reject absolute paths pointing outside workspace', () => {
    const outsideFile = path.join(outsideDir, 'secret.env');
    expect(() => {
      resolveAndValidateWorkspacePath(outsideFile, [tmpWorkspace]);
    }).toThrowError(WorkspaceSecurityError);
  });

  it('should reject null byte injection in paths', () => {
    expect(() => {
      resolveAndValidateWorkspacePath('src/auth/login.ts\0.png', [tmpWorkspace]);
    }).toThrowError(WorkspaceSecurityError);
  });

  it('should detect and reject symlinks that escape the workspace boundary', () => {
    const symlinkPath = path.join(tmpWorkspace, 'escaped_secret.txt');
    try {
      fs.symlinkSync(path.join(outsideDir, 'secret.env'), symlinkPath);
    } catch {
      // Symlinks may require elevated privileges on some environments, skip if creation failed
      return;
    }

    expect(() => {
      resolveAndValidateWorkspacePath('escaped_secret.txt', [tmpWorkspace]);
    }).toThrowError(WorkspaceSecurityError);
  });
});
