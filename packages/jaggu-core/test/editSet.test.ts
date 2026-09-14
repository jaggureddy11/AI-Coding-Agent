import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EditSetManager } from '../src/diff/editSetManager.js';
import { InMemoryVirtualDocStore } from '../src/diff/virtualDocStore.js';
import { EventBus } from '../src/events/eventBus.js';

describe('EditSetManager', () => {
  let tmpDir: string;
  let docStore: InMemoryVirtualDocStore;
  let eventBus: EventBus;
  let manager: EditSetManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-editset-test-'));
    fs.mkdirSync(path.join(tmpDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'login.ts'), 'export const login = 1;');
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'auth.test.ts'), 'test("login", () => {});');

    docStore = new InMemoryVirtualDocStore();
    eventBus = new EventBus();
    manager = new EditSetManager(docStore, eventBus, [tmpDir]);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should stage a multi-file edit set in shadow store', () => {
    const result = manager.createEditSet([
      { relativePath: 'src/auth/login.ts', proposedContent: 'export const login = 2;' },
      { relativePath: 'src/auth/rateLimit.ts', proposedContent: 'export const rateLimit = true;', isNewFile: true },
    ]);

    expect(result.success).toBe(true);
    expect(result.editSet).toBeDefined();
    expect(result.editSet?.files.length).toBe(2);
    expect(result.editSet?.status).toBe('PROPOSED');

    const shadowLogin = `jaggu-shadow://${path.join(tmpDir, 'src', 'auth', 'login.ts')}`;
    expect(docStore.has(shadowLogin)).toBe(true);
    expect(docStore.get(shadowLogin)?.proposedContent).toBe('export const login = 2;');
  });

  it('should reject and evict virtual documents', () => {
    const create = manager.createEditSet([
      { relativePath: 'src/auth/login.ts', proposedContent: 'export const login = 2;' },
    ]);
    const id = create.editSet!.id;

    const rejected = manager.rejectEditSet(id, 'User denied changes');
    expect(rejected).toBe(true);
    expect(manager.getEditSet(id)?.status).toBe('REJECTED');

    const shadowLogin = `jaggu-shadow://${path.join(tmpDir, 'src', 'auth', 'login.ts')}`;
    expect(docStore.has(shadowLogin)).toBe(false);
  });

  it('should fail apply when approval is false', () => {
    const create = manager.createEditSet([
      { relativePath: 'src/auth/login.ts', proposedContent: 'export const login = 2;' },
    ]);
    const id = create.editSet!.id;

    const applyResult = manager.applyEditSet(id, false);
    expect(applyResult.success).toBe(false);
    expect(applyResult.error).toContain('explicit user approval');
  });

  it('should apply all files atomically when approved and hashes match', () => {
    const create = manager.createEditSet([
      { relativePath: 'src/auth/login.ts', proposedContent: 'export const login = 2;' },
      { relativePath: 'src/auth/rateLimit.ts', proposedContent: 'export const rateLimit = true;', isNewFile: true },
    ]);
    const id = create.editSet!.id;

    const applyResult = manager.applyEditSet(id, true);
    expect(applyResult.success).toBe(true);
    expect(applyResult.appliedFiles.length).toBe(2);

    expect(fs.readFileSync(path.join(tmpDir, 'src', 'auth', 'login.ts'), 'utf-8')).toBe('export const login = 2;');
    expect(fs.readFileSync(path.join(tmpDir, 'src', 'auth', 'rateLimit.ts'), 'utf-8')).toBe('export const rateLimit = true;');

    const shadowLogin = `jaggu-shadow://${path.join(tmpDir, 'src', 'auth', 'login.ts')}`;
    expect(docStore.has(shadowLogin)).toBe(false);
  });

  it('should detect concurrent conflict on one file and reject entire EditSet without writing anything', () => {
    // 3 files proposed
    const create = manager.createEditSet([
      { relativePath: 'src/auth/login.ts', proposedContent: 'export const login = 999;' },
      { relativePath: 'src/auth/auth.test.ts', proposedContent: 'test("login updated", () => {});' },
      { relativePath: 'src/auth/rateLimit.ts', proposedContent: 'export const rateLimit = true;', isNewFile: true },
    ]);
    const id = create.editSet!.id;

    // Simulate concurrent modification to auth.test.ts on disk after proposal
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'auth.test.ts'), '// External developer edit');

    const applyResult = manager.applyEditSet(id, true);
    expect(applyResult.success).toBe(false);
    expect(applyResult.error).toContain('Conflict detected');
    expect(applyResult.failedFile).toBe('src/auth/auth.test.ts');
    expect(manager.getEditSet(id)?.status).toBe('CONFLICT');

    // Verify NOTHING was applied
    expect(fs.readFileSync(path.join(tmpDir, 'src', 'auth', 'login.ts'), 'utf-8')).toBe('export const login = 1;');
    expect(fs.existsSync(path.join(tmpDir, 'src', 'auth', 'rateLimit.ts'))).toBe(false);
  });

  it('should handle 5-file edit set staging and apply', () => {
    const fileInputs = [];
    for (let i = 1; i <= 5; i++) {
      const rel = `src/file_${i}.ts`;
      fs.writeFileSync(path.join(tmpDir, rel), `const v = ${i};`);
      fileInputs.push({ relativePath: rel, proposedContent: `const v = ${i * 10};` });
    }

    const create = manager.createEditSet(fileInputs);
    expect(create.success).toBe(true);
    expect(create.editSet?.files.length).toBe(5);

    const applyResult = manager.applyEditSet(create.editSet!.id, true);
    expect(applyResult.success).toBe(true);
    expect(applyResult.appliedFiles.length).toBe(5);

    for (let i = 1; i <= 5; i++) {
      const content = fs.readFileSync(path.join(tmpDir, `src/file_${i}.ts`), 'utf-8');
      expect(content).toBe(`const v = ${i * 10};`);
    }
  });
});
