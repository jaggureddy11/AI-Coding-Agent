import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import {
  EventBus,
  ModelGateway,
  InMemoryVirtualDocStore,
  WorkspaceDiscovery,
  ContextEngine,
  MockModelProvider,
  Plan,
  EditSet,
} from '@jaggu/core';
import {
  isValidWebviewMessage,
  isValidExtensionMessage,
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '@jaggu/ui';
import { activate, deactivate } from '../src/extension.js';
import { JagguSidebarProvider } from '../src/sidebarProvider.js';
import { CredentialManager } from '../src/credentials.js';

describe('M7-B: Real IDE Integration & End-to-End Validation Suite', () => {
  let tmpFixtureDir: string;

  beforeEach(() => {
    // Create an isolated copy of the fixture repo for every test run
    const fixtureSource = path.resolve(__dirname, '../../../test/fixtures/m7b-fixture-repo');
    tmpFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-m7b-run-'));
    fs.cpSync(fixtureSource, tmpFixtureDir, { recursive: true });
  });

  afterEach(() => {
    if (tmpFixtureDir && fs.existsSync(tmpFixtureDir)) {
      fs.rmSync(tmpFixtureDir, { recursive: true, force: true });
    }
  });

  it('PHASE 2 & 3: should activate extension in IDE host, verify status bar, and bootstrap Webview with CSP & RPC', async () => {
    const mockContext = {
      subscriptions: [] as any[],
      extensionUri: {
        toString: () => 'file:///mock/ext',
        fsPath: '/mock/ext',
      },
      secrets: {
        get: vi.fn().mockResolvedValue(undefined),
        store: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        onDidChange: vi.fn(),
      },
    } as any;

    const activated = activate(mockContext);

    // 1. Verify Extension Host components
    expect(activated.eventBus).toBeInstanceOf(EventBus);
    expect(activated.docStore).toBeInstanceOf(InMemoryVirtualDocStore);
    expect(activated.sidebarProvider).toBeInstanceOf(JagguSidebarProvider);
    expect(activated.statusBarItem).toBeDefined();
    expect(activated.statusBarItem.text).toContain('Ready');

    // 2. Verify registered commands
    const cmds = (vscode.commands as any).__getRegisteredCommands();
    expect(cmds['jaggu.openChat']).toBeDefined();
    expect(cmds['jaggu.startSession']).toBeDefined();
    expect(cmds['jaggu.cancelSession']).toBeDefined();
    expect(cmds['jaggu.approvePlan']).toBeDefined();
    expect(cmds['jaggu.approveEditSet']).toBeDefined();

    // 3. Verify Webview HTML rendering & strict CSP
    const mockWebview = {
      asWebviewUri: (uri: any) => uri,
      cspSource: 'vscode-webview:',
    } as any;
    const html = activated.sidebarProvider.getHtmlForWebview(mockWebview);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('nonce-');
    expect(html).toContain('webview.js');
    expect(html).toContain('webview.css');
    expect(html).toContain('<div id="root"></div>');

    // 4. Verify RPC Handshake
    const receivedMessages: ExtensionToWebviewMessage[] = [];
    activated.sidebarProvider.postMessageToWebview = (msg: any) => {
      if (isValidExtensionMessage(msg)) {
        receivedMessages.push(msg);
      }
      return Promise.resolve(true);
    };

    await activated.sidebarProvider.handleIncomingMessage({
      type: 'ui.ready',
      payload: { timestamp: Date.now() },
    });

    expect(receivedMessages.length).toBeGreaterThanOrEqual(2);
    expect(receivedMessages[0].type).toBe('agent.config');
    expect(receivedMessages[1].type).toBe('agent.status');
    expect((receivedMessages[1] as any).payload.state).toBe('IDLE');

    deactivate();
  });

  it('PHASE 6, 7 & 10: should execute full end-to-end coding task through AgentOrchestrator on real fixture workspace', async () => {
    const eventBus = new EventBus();
    const docStore = new InMemoryVirtualDocStore();
    const discovery = new WorkspaceDiscovery([tmpFixtureDir]);
    const contextEngine = new ContextEngine(discovery);
    const modelGateway = new ModelGateway();

    const validPlanJson = JSON.stringify({
      id: 'plan_user_validation',
      goal: 'Add input validation to user registration flow in userService.ts and update tests',
      assumptions: ['UserRepository is available'],
      steps: [
        {
          id: 'step_1',
          description: 'Add validation for username, email, and password in userService.ts',
          files: ['src/user/userService.ts'],
          dependencies: [],
          expectedOutcome: 'Throws on empty username or invalid email',
          verification: 'npm test',
          status: 'pending',
        },
        {
          id: 'step_2',
          description: 'Add comprehensive validation test cases in test/userService.test.js',
          files: ['test/userService.test.js'],
          dependencies: ['step_1'],
          expectedOutcome: 'All validation tests pass',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: ['None'],
      verification: ['npm test'],
    });

    const editSetJson = JSON.stringify({
      files: [
        {
          relativePath: 'src/user/userService.ts',
          proposedContent: `import { UserRepository, User } from './userRepository.js';

export interface RegistrationInput {
  username: string;
  email: string;
  password?: string;
}

export class UserService {
  constructor(private repo: UserRepository) {}

  public register(input: RegistrationInput): User {
    if (!input.username || input.username.trim() === '') {
      throw new Error('Username cannot be empty');
    }
    if (!input.email || !input.email.includes('@') || !input.email.includes('.')) {
      throw new Error('Invalid email address format');
    }
    if (input.password && input.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const user: User = {
      id: \`user_\${Date.now()}\`,
      username: input.username,
      email: input.email,
      createdAt: new Date(),
    };
    this.repo.save(user);
    return user;
  }
}
`,
          isNewFile: false,
        },
        {
          relativePath: 'test/userService.test.js',
          proposedContent: `import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('UserService Input Validation Tests', () => {
  it('should reject empty username', () => {
    assert.throws(() => {
      const username = '';
      if (!username) throw new Error('Username cannot be empty');
    }, /Username cannot be empty/);
  });

  it('should reject invalid email', () => {
    assert.throws(() => {
      const email = 'invalid-email';
      if (!email.includes('@')) throw new Error('Invalid email address format');
    }, /Invalid email address format/);
  });
});
`,
          isNewFile: false,
        },
      ],
    });

    const mockProvider = new MockModelProvider({
      turns: [
        { textResponse: validPlanJson },
        { textResponse: editSetJson },
        { textResponse: 'Successfully added input validation and tests.' },
      ],
    });
    modelGateway.registerProvider(mockProvider);

    let planApprovalRequested = false;
    let editApprovalRequested = false;

    const sidebarProvider = new JagguSidebarProvider(
      { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    // Wire simulated Webview RPC responses to approval requests
    sidebarProvider.postMessageToWebview = (msg: any) => {
      if (msg.type === 'agent.plan_requested') {
        planApprovalRequested = true;
        setTimeout(() => {
          sidebarProvider.handleIncomingMessage({
            type: 'agent.plan_approve',
            payload: { planId: msg.payload.planId },
          });
        }, 10);
      } else if (msg.type === 'agent.editset_requested') {
        editApprovalRequested = true;
        setTimeout(() => {
          sidebarProvider.handleIncomingMessage({
            type: 'agent.editset_approve',
            payload: { editSetId: msg.payload.editSetId },
          });
        }, 10);
      }
      return Promise.resolve(true);
    };

    const orchestrator = sidebarProvider.createOrchestrator([tmpFixtureDir]);

    // Execute the task
    const result = await orchestrator.executeTask(
      'Add input validation to user registration in userService.ts. Reject empty usernames, invalid emails, and short passwords. Add tests.',
    );

    // Assertions
    expect(result.success).toBe(true);
    expect(planApprovalRequested).toBe(true);
    expect(editApprovalRequested).toBe(true);

    // Verify files were actually written to disk in fixture workspace
    const updatedService = fs.readFileSync(
      path.join(tmpFixtureDir, 'src/user/userService.ts'),
      'utf-8',
    );
    expect(updatedService).toContain('Username cannot be empty');
    expect(updatedService).toContain('Invalid email address format');

    const updatedTests = fs.readFileSync(
      path.join(tmpFixtureDir, 'test/userService.test.js'),
      'utf-8',
    );
    expect(updatedTests).toContain('UserService Input Validation Tests');
  });

  it('PHASE 8: should enforce selective file approval and leave rejected files untouched byte-for-byte', async () => {
    const eventBus = new EventBus();
    const docStore = new InMemoryVirtualDocStore();
    const discovery = new WorkspaceDiscovery([tmpFixtureDir]);
    const contextEngine = new ContextEngine(discovery);
    const modelGateway = new ModelGateway();

    const originalTestContent = fs.readFileSync(
      path.join(tmpFixtureDir, 'test/userService.test.js'),
      'utf-8',
    );

    const validPlanJson = JSON.stringify({
      id: 'plan_selective_approval',
      goal: 'Update userService and test files',
      assumptions: [],
      steps: [
        {
          id: 's1',
          description: 'Modify userService.ts',
          files: ['src/user/userService.ts'],
          dependencies: [],
          expectedOutcome: 'UserService modified',
          verification: 'npm test',
          status: 'pending',
        },
        {
          id: 's2',
          description: 'Modify test file',
          files: ['test/userService.test.js'],
          dependencies: [],
          expectedOutcome: 'Test file modified',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: [],
      verification: ['npm test'],
    });

    const editSetJson = JSON.stringify({
      files: [
        {
          relativePath: 'src/user/userService.ts',
          proposedContent: '// Approved modification in userService.ts\n',
          isNewFile: false,
        },
        {
          relativePath: 'test/userService.test.js',
          proposedContent: '// REJECTED modification in test file\n',
          isNewFile: false,
        },
      ],
    });

    const mockProvider = new MockModelProvider({
      turns: [
        { textResponse: validPlanJson },
        { textResponse: editSetJson },
        { textResponse: 'Partial edits completed.' },
      ],
    });
    modelGateway.registerProvider(mockProvider);

    const sidebarProvider = new JagguSidebarProvider(
      { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    // Simulate selective approval via Webview RPC: approve userService.ts, reject test/userService.test.js
    sidebarProvider.postMessageToWebview = (msg: any) => {
      if (msg.type === 'agent.plan_requested') {
        setTimeout(() => {
          sidebarProvider.handleIncomingMessage({
            type: 'agent.plan_approve',
            payload: { planId: msg.payload.planId },
          });
        }, 10);
      } else if (msg.type === 'agent.editset_requested') {
        setTimeout(() => {
          sidebarProvider.handleIncomingMessage({
            type: 'agent.editset_approve',
            payload: {
              editSetId: msg.payload.editSetId,
              approvedFiles: ['src/user/userService.ts'],
              rejectedFiles: ['test/userService.test.js'],
            },
          });
        }, 10);
      }
      return Promise.resolve(true);
    };

    const orchestrator = sidebarProvider.createOrchestrator([tmpFixtureDir]);
    const result = await orchestrator.executeTask('Modify user service and tests');

    expect(result.success).toBe(true);

    // 1. Approved file was modified on disk
    const appliedService = fs.readFileSync(path.join(tmpFixtureDir, 'src/user/userService.ts'), 'utf-8');
    expect(appliedService).toBe('// Approved modification in userService.ts\n');

    // 2. Rejected file remains EXACTLY byte-for-byte identical to original
    const untouchedTest = fs.readFileSync(path.join(tmpFixtureDir, 'test/userService.test.js'), 'utf-8');
    expect(untouchedTest).toBe(originalTestContent);
  });

  it('PHASE 11: should preserve pre-existing user modifications in unrelated files (Git safety)', async () => {
    const eventBus = new EventBus();
    const docStore = new InMemoryVirtualDocStore();
    const discovery = new WorkspaceDiscovery([tmpFixtureDir]);
    const contextEngine = new ContextEngine(discovery);
    const modelGateway = new ModelGateway();

    // 1. Create a pre-existing user modification in authService.ts before running task
    const dirtyAuthContent = '// Developer WIP: Custom JWT Secret\nexport const WIP_SECRET = "dev_secret_123";\n';
    fs.writeFileSync(path.join(tmpFixtureDir, 'src/auth/authService.ts'), dirtyAuthContent, 'utf-8');

    const validPlanJson = JSON.stringify({
      id: 'plan_scoped_change',
      goal: 'Update userService.ts only',
      assumptions: [],
      steps: [
        {
          id: 's1',
          description: 'Update user service',
          files: ['src/user/userService.ts'],
          dependencies: [],
          expectedOutcome: 'UserService updated',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: [],
      verification: ['npm test'],
    });

    const editSetJson = JSON.stringify({
      files: [
        {
          relativePath: 'src/user/userService.ts',
          proposedContent: '// Scoped change\n',
          isNewFile: false,
        },
      ],
    });

    const mockProvider = new MockModelProvider({
      turns: [
        { textResponse: validPlanJson },
        { textResponse: editSetJson },
        { textResponse: 'Scoped update complete.' },
      ],
    });
    modelGateway.registerProvider(mockProvider);

    const sidebarProvider = new JagguSidebarProvider(
      { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    sidebarProvider.postMessageToWebview = (msg: any) => {
      if (msg.type === 'agent.plan_requested') {
        setTimeout(() => {
          sidebarProvider.handleIncomingMessage({
            type: 'agent.plan_approve',
            payload: { planId: msg.payload.planId },
          });
        }, 10);
      } else if (msg.type === 'agent.editset_requested') {
        setTimeout(() => {
          sidebarProvider.handleIncomingMessage({
            type: 'agent.editset_approve',
            payload: { editSetId: msg.payload.editSetId },
          });
        }, 10);
      }
      return Promise.resolve(true);
    };

    const orchestrator = sidebarProvider.createOrchestrator([tmpFixtureDir]);
    const result = await orchestrator.executeTask('Update userService.ts');

    expect(result.success).toBe(true);

    // Pre-existing user modifications in authService.ts must remain completely untouched
    const preservedAuth = fs.readFileSync(path.join(tmpFixtureDir, 'src/auth/authService.ts'), 'utf-8');
    expect(preservedAuth).toBe(dirtyAuthContent);
  });

  it('PHASE 12: should support task cancellation mid-flight and cleanly abort execution', async () => {
    const eventBus = new EventBus();
    const docStore = new InMemoryVirtualDocStore();
    const discovery = new WorkspaceDiscovery([tmpFixtureDir]);
    const contextEngine = new ContextEngine(discovery);
    const modelGateway = new ModelGateway();

    const mockProvider = new MockModelProvider({
      chunkDelayMs: 200, // Delay streaming
      responses: ['Long running response...'],
    });
    modelGateway.registerProvider(mockProvider);

    const sidebarProvider = new JagguSidebarProvider(
      { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    const receivedInWebview: ExtensionToWebviewMessage[] = [];
    sidebarProvider.postMessageToWebview = (msg: any) => {
      receivedInWebview.push(msg);
      return Promise.resolve(true);
    };

    // 1. Submit prompt
    const submitPromise = sidebarProvider.handleIncomingMessage({
      type: 'user.submit',
      payload: { id: 'task_to_cancel', text: 'Run lengthy generation', timestamp: Date.now() },
    });

    expect(sidebarProvider.currentStatus).toBe('PROCESSING');

    // 2. Emit cancel message
    await new Promise((r) => setTimeout(r, 20));
    sidebarProvider.handleIncomingMessage({
      type: 'agent.cancel',
      payload: {},
    });

    await submitPromise;

    expect(sidebarProvider.currentStatus).toBe('CANCELLED');
    const cancelMsg = receivedInWebview.find(
      (m) => m.type === 'agent.status' && (m as any).payload.state === 'CANCELLED',
    );
    expect(cancelMsg).toBeDefined();
  });

  it('PHASE 9: should collect VS Code language service diagnostics and trigger self-healing repair loop', async () => {
    const eventBus = new EventBus();
    const docStore = new InMemoryVirtualDocStore();
    const discovery = new WorkspaceDiscovery([tmpFixtureDir]);
    const contextEngine = new ContextEngine(discovery);
    const modelGateway = new ModelGateway();

    const validPlanJson = JSON.stringify({
      id: 'plan_diag_repair',
      goal: 'Update userService.ts with correct types',
      assumptions: [],
      steps: [
        {
          id: 's1',
          description: 'Update userService.ts',
          files: ['src/user/userService.ts'],
          dependencies: [],
          expectedOutcome: 'Valid types',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: [],
      verification: ['npm test'],
    });

    // 1. Initial edit has a diagnostic syntax error / missing return
    const buggyEditSetJson = JSON.stringify({
      files: [
        {
          relativePath: 'src/user/userService.ts',
          proposedContent: `export class UserService {
  register(input: any) {
    // missing return or syntax error
  }
}
`,
          isNewFile: false,
        },
      ],
    });

    // 2. Corrected edit produced during self-healing repair turn
    const fixedEditSetJson = JSON.stringify({
      files: [
        {
          relativePath: 'src/user/userService.ts',
          proposedContent: `import { UserRepository, User } from './userRepository.js';

export class UserService {
  constructor(private repo: UserRepository) {}
  public register(input: { username: string; email: string }): User {
    const user = { id: 'u1', username: input.username, email: input.email, createdAt: new Date() };
    this.repo.save(user);
    return user;
  }
}
`,
          isNewFile: false,
        },
      ],
    });

    const mockProvider = new MockModelProvider({
      turns: [
        { textResponse: validPlanJson },
        { textResponse: buggyEditSetJson },
        { textResponse: fixedEditSetJson },
        { textResponse: 'Diagnostic error resolved and verified.' },
      ],
    });
    modelGateway.registerProvider(mockProvider);

    const sidebarProvider = new JagguSidebarProvider(
      { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    sidebarProvider.postMessageToWebview = (msg: any) => {
      if (msg.type === 'agent.plan_requested') {
        setTimeout(() => {
          sidebarProvider.handleIncomingMessage({
            type: 'agent.plan_approve',
            payload: { planId: msg.payload.planId },
          });
        }, 10);
      } else if (msg.type === 'agent.editset_requested') {
        setTimeout(() => {
          sidebarProvider.handleIncomingMessage({
            type: 'agent.editset_approve',
            payload: { editSetId: msg.payload.editSetId },
          });
        }, 10);
      }
      return Promise.resolve(true);
    };

    // Diagnostics provider that returns an error on the first check and clears it after repair
    let checkCount = 0;
    const mockDiagnosticsProvider = {
      getDiagnostics: async () => {
        checkCount++;
        if (checkCount === 1) {
          return [
            {
              file: 'src/user/userService.ts',
              line: 2,
              column: 1,
              message: "Type 'void' is not assignable to type 'User'.",
              severity: 'error' as const,
              source: 'typescript',
            },
          ];
        }
        return [];
      },
    };

    const orchestrator = sidebarProvider.createOrchestrator([tmpFixtureDir], mockDiagnosticsProvider);
    const result = await orchestrator.executeTask('Fix type errors in user service');

    expect(result.success).toBe(true);
    expect(result.repairCount).toBeGreaterThanOrEqual(1);

    const finalService = fs.readFileSync(path.join(tmpFixtureDir, 'src/user/userService.ts'), 'utf-8');
    expect(finalService).toContain('class UserService');
    expect(finalService).toContain('this.repo.save(user)');
  });

  it('PHASE 5: should support real online Hugging Face ModelGateway routing when HF_TOKEN is configured', async () => {
    const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    const gateway = new ModelGateway();

    if (!token) {
      // In CI/dev environments without token, verify mock provider streaming via ModelGateway
      const chunks: string[] = [];
      for await (const chunk of gateway.streamChat('mock', [{ role: 'user', content: 'Say hello' }], { model: 'mock-fast' })) {
        if (chunk.type === 'token') chunks.push(chunk.text);
      }
      expect(chunks.join('')).toContain('Say hello');
      return;
    }

    gateway.registerProvider(new HuggingFaceProvider({ apiKey: token }));
    const chunks: string[] = [];
    for await (const chunk of gateway.streamChat('huggingface', [{ role: 'user', content: 'Return only the word OK' }], { model: 'Qwen/Qwen2.5-Coder-32B-Instruct', maxTokens: 10 })) {
      if (chunk.type === 'token') chunks.push(chunk.text);
    }

    expect(chunks.join('').length).toBeGreaterThan(0);
  });

  it('PHASE 14: should guarantee credential isolation (no secrets in Webview RPC or state)', async () => {
    const secretKey = 'hf_DUMMY_SECRET_FOR_ISOLATION_TEST';
    const mockSecrets = {
      get: vi.fn().mockResolvedValue(secretKey),
      store: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      onDidChange: vi.fn(),
    } as any;

    const credManager = new CredentialManager(mockSecrets);
    const eventBus = new EventBus();
    const modelGateway = new ModelGateway();

    const sidebarProvider = new JagguSidebarProvider(
      { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any,
      eventBus,
      modelGateway,
      credManager,
    );

    const receivedInWebview: ExtensionToWebviewMessage[] = [];
    sidebarProvider.postMessageToWebview = (msg: any) => {
      receivedInWebview.push(msg);
      return Promise.resolve(true);
    };

    // Send ui.ready
    await sidebarProvider.handleIncomingMessage({
      type: 'ui.ready',
      payload: { timestamp: Date.now() },
    });

    // Check all emitted messages to ensure the secret value NEVER entered Webview payloads
    const serializedMessages = JSON.stringify(receivedInWebview);
    expect(serializedMessages).not.toContain(secretKey);

    // Verify config only contains provider ID and non-secret metadata
    const configMsg = receivedInWebview.find((m) => m.type === 'agent.config');
    expect(configMsg).toBeDefined();
    expect((configMsg as any).payload.provider).toBeDefined();
    expect((configMsg as any).payload.apiKey).toBeUndefined();
  });
});
