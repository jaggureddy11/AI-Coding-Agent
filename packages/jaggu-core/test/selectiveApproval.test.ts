import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EditSetManager } from '../src/diff/editSetManager.js';
import { InMemoryVirtualDocStore } from '../src/diff/virtualDocStore.js';
import { EventBus } from '../src/events/eventBus.js';

describe('Selective / Partial Approval of EditSets (M6 Pillar 3)', () => {
  let tempDir: string;
  let docStore: InMemoryVirtualDocStore;
  let eventBus: EventBus;
  let manager: EditSetManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-selective-test-'));
    docStore = new InMemoryVirtualDocStore();
    eventBus = new EventBus();
    manager = new EditSetManager(docStore, eventBus, [tempDir]);

    // Create baseline files
    fs.writeFileSync(path.join(tempDir, 'src_auth.ts'), 'export const auth = false;\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'src_routes.ts'), 'export const routes = [];\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'src_config.ts'), 'export const config = { port: 3000 };\n', 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should apply only selected approved files and leave rejected files completely untouched', () => {
    const staged = manager.createEditSet([
      {
        relativePath: 'src_auth.ts',
        proposedContent: 'export const auth = true;\n',
        isNewFile: false,
      },
      {
        relativePath: 'src_routes.ts',
        proposedContent: 'export const routes = ["/login"];\n',
        isNewFile: false,
      },
      {
        relativePath: 'src_config.ts',
        proposedContent: 'export const config = { port: 8080 };\n',
        isNewFile: false,
      },
    ]);

    expect(staged.success).toBe(true);
    const editSet = staged.editSet!;
    expect(editSet.files).toHaveLength(3);

    // User selectively approves src_auth.ts and src_routes.ts, rejecting src_config.ts
    const approvedFiles = ['src_auth.ts', 'src_routes.ts'];
    const applyResult = manager.applyEditSet(editSet.id, true, approvedFiles);

    expect(applyResult.success).toBe(true);
    expect(applyResult.appliedFiles).toEqual(['src_auth.ts', 'src_routes.ts']);
    expect(applyResult.rejectedFiles).toEqual(['src_config.ts']);

    // Check disk content: approved files are mutated
    const authContent = fs.readFileSync(path.join(tempDir, 'src_auth.ts'), 'utf8');
    expect(authContent).toBe('export const auth = true;\n');

    const routesContent = fs.readFileSync(path.join(tempDir, 'src_routes.ts'), 'utf8');
    expect(routesContent).toBe('export const routes = ["/login"];\n');

    // CRITICAL TEST: rejected file must remain untouched with original content
    const configContent = fs.readFileSync(path.join(tempDir, 'src_config.ts'), 'utf8');
    expect(configContent).toBe('export const config = { port: 3000 };\n');

    // Shadow document for rejected file must be purged from memory
    const configShadowUri = editSet.files.find((f) => f.relativePath === 'src_config.ts')!.shadowUri;
    expect(docStore.get(configShadowUri)).toBeUndefined();
  });

  it('should leave all files untouched on disk when user rejects entire edit set', () => {
    const staged = manager.createEditSet([
      {
        relativePath: 'src_auth.ts',
        proposedContent: 'export const auth = true;\n',
        isNewFile: false,
      },
      {
        relativePath: 'src_routes.ts',
        proposedContent: 'export const routes = ["/login"];\n',
        isNewFile: false,
      },
    ]);

    expect(staged.success).toBe(true);
    const editSet = staged.editSet!;

    const rejectResult = manager.rejectEditSet(editSet.id, 'User declined all changes');
    expect(rejectResult).toBe(true);
    expect(editSet.status).toBe('REJECTED');

    // Check disk content: neither file is modified
    expect(fs.readFileSync(path.join(tempDir, 'src_auth.ts'), 'utf8')).toBe('export const auth = false;\n');
    expect(fs.readFileSync(path.join(tempDir, 'src_routes.ts'), 'utf8')).toBe('export const routes = [];\n');
  });

  it('should refuse selective application if an approved file suffered external concurrent modification', () => {
    const staged = manager.createEditSet([
      {
        relativePath: 'src_auth.ts',
        proposedContent: 'export const auth = true;\n',
        isNewFile: false,
      },
      {
        relativePath: 'src_routes.ts',
        proposedContent: 'export const routes = ["/login"];\n',
        isNewFile: false,
      },
    ]);

    expect(staged.success).toBe(true);
    const editSet = staged.editSet!;

    // External modification to src_auth.ts before approval
    fs.writeFileSync(path.join(tempDir, 'src_auth.ts'), 'export const auth = "external_conflict";\n', 'utf8');

    const applyResult = manager.applyEditSet(editSet.id, true, ['src_auth.ts']);
    expect(applyResult.success).toBe(false);
    expect(applyResult.error).toMatch(/Conflict detected/i);
    expect(applyResult.failedFile).toBe('src_auth.ts');

    // Verify external content was preserved
    expect(fs.readFileSync(path.join(tempDir, 'src_auth.ts'), 'utf8')).toBe(
      'export const auth = "external_conflict";\n',
    );
  });
});
