import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  EventBus,
  ModelGateway,
  MockModelProvider,
  InMemoryVirtualDocStore,
  ContextEngine,
  WorkspaceDiscovery,
} from '@jaggu/core';
import { JagguSidebarProvider } from '../src/sidebarProvider.js';
import { ExtensionToWebviewMessage } from '@jaggu/ui';

describe('M4 Agent Action Loop & Tool Execution Integration', () => {
  let tmpDir: string;
  let eventBus: EventBus;
  let docStore: InMemoryVirtualDocStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-m4-agent-'));
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-fixture',
        scripts: { test: 'node -e "console.log(\\"tests pass\\")"' },
      }),
      'utf8',
    );
    eventBus = new EventBus();
    docStore = new InMemoryVirtualDocStore();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('executes full M4 vertical slice: search -> read -> propose_edit -> approval -> apply -> run_tests -> final summary', async () => {
    // 1. Prepare target file on disk
    const apiFile = path.join(tmpDir, 'src', 'api.ts');
    const originalContent = 'export function handleLogin(req: any) {\n  return true;\n}\n';
    fs.writeFileSync(apiFile, originalContent, 'utf8');

    const proposedContent = 'export function handleLogin(req: any) {\n  if (!req.body?.email) throw new Error("Invalid email");\n  return true;\n}\n';

    // 2. Set up MockModelProvider with multi-turn sequence
    const mockProvider = new MockModelProvider({
      turns: [
        {
          toolCall: {
            id: 'call_search',
            name: 'search_code',
            arguments: { query: 'handleLogin' },
          },
        },
        {
          toolCall: {
            id: 'call_read',
            name: 'read_file',
            arguments: { filePath: 'src/api.ts' },
          },
        },
        {
          toolCall: {
            id: 'call_propose',
            name: 'propose_edit',
            arguments: {
              path: 'src/api.ts',
              proposedContent,
              reason: 'Add input validation for email to handleLogin',
            },
          },
        },
        {
          toolCall: {
            id: 'call_tests',
            name: 'run_tests',
            arguments: { command: 'npm test' },
          },
        },
        {
          text: 'Successfully added input validation to src/api.ts and verified tests pass.',
        },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const discovery = new WorkspaceDiscovery([tmpDir]);
    const contextEngine = new ContextEngine(discovery);

    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(
      extensionUri,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    // Track all messages sent to webview
    const webviewMessages: ExtensionToWebviewMessage[] = [];
    let approvalRequestedMsg: any = null;

    provider.postMessageToWebview = (msg: any) => {
      webviewMessages.push(msg);
      if (msg.type === 'agent.approval_requested') {
        approvalRequestedMsg = msg;
        // Asynchronously simulate user clicking "Approve" in the Webview UI
        setTimeout(() => {
          provider.handleIncomingMessage({
            type: 'agent.approve',
            payload: { proposalId: msg.payload.proposalId },
          });
        }, 10);
      }
      return Promise.resolve(true);
    };

    // 3. Submit user prompt
    await provider.handleIncomingMessage({
      type: 'user.submit',
      payload: {
        id: 'task_vertical_slice',
        text: 'Add input validation to this API endpoint.',
        timestamp: Date.now(),
      },
    });

    // 4. Verify Approval request was received
    expect(approvalRequestedMsg).toBeDefined();
    expect(approvalRequestedMsg.payload.filePath).toContain('src/api.ts');
    expect(approvalRequestedMsg.payload.diffSummary).toContain('+');

    // 5. Verify the file on disk was ACTUALLY modified with proposed content
    const updatedContent = fs.readFileSync(apiFile, 'utf8');
    expect(updatedContent).toBe(proposedContent);

    // 6. Verify activities were communicated to user
    const activities = webviewMessages
      .filter((m) => m.type === 'agent.activity')
      .map((m: any) => m.payload.message);

    expect(activities.some((a) => a.includes('Searching repository'))).toBe(true);
    expect(activities.some((a) => a.includes('Reading src/api.ts'))).toBe(true);
    expect(activities.some((a) => a.includes('Preparing changes'))).toBe(true);
    expect(activities.some((a) => a.includes('Waiting for approval'))).toBe(true);
    expect(activities.some((a) => a.includes('Applying changes'))).toBe(true);
    expect(activities.some((a) => a.includes('Running tests'))).toBe(true);

    // 7. Verify final text completion
    const completeMsg = webviewMessages.find((m) => m.type === 'token.complete');
    expect(completeMsg).toBeDefined();
    expect((completeMsg as any).payload.fullText).toContain('Successfully added input validation');
  });

  it('respects rejection flow: file on disk remains untouched when user rejects proposed edit', async () => {
    const apiFile = path.join(tmpDir, 'src', 'api.ts');
    const originalContent = 'export function handleLogin() { return true; }\n';
    fs.writeFileSync(apiFile, originalContent, 'utf8');

    const proposedContent = 'export function handleLogin() { throw new Error("Blocked"); }\n';

    const mockProvider = new MockModelProvider({
      turns: [
        {
          toolCall: {
            id: 'call_propose',
            name: 'propose_edit',
            arguments: {
              path: 'src/api.ts',
              proposedContent,
              reason: 'Block login',
            },
          },
        },
        {
          text: 'Understood. The proposed changes were rejected and not applied to your workspace.',
        },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const discovery = new WorkspaceDiscovery([tmpDir]);
    const contextEngine = new ContextEngine(discovery);

    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(
      extensionUri,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    provider.postMessageToWebview = (msg: any) => {
      if (msg.type === 'agent.approval_requested') {
        // User rejects edit!
        setTimeout(() => {
          provider.handleIncomingMessage({
            type: 'agent.reject',
            payload: { proposalId: msg.payload.proposalId, reason: 'Too restrictive' },
          });
        }, 10);
      }
      return Promise.resolve(true);
    };

    await provider.handleIncomingMessage({
      type: 'user.submit',
      payload: {
        id: 'task_rejection',
        text: 'Modify login endpoint',
        timestamp: Date.now(),
      },
    });

    // File MUST be untouched
    const currentDiskContent = fs.readFileSync(apiFile, 'utf8');
    expect(currentDiskContent).toBe(originalContent);
  });

  it('detects concurrent modification conflicts and refuses to overwrite changed disk files', async () => {
    const apiFile = path.join(tmpDir, 'src', 'conflict.ts');
    const originalContent = 'line 1\n';
    fs.writeFileSync(apiFile, originalContent, 'utf8');

    const mockProvider = new MockModelProvider({
      turns: [
        {
          toolCall: {
            id: 'call_propose',
            name: 'propose_edit',
            arguments: {
              path: 'src/conflict.ts',
              proposedContent: 'line 1\nproposed line 2\n',
            },
          },
        },
        {
          text: 'Final response after conflict check.',
        },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const discovery = new WorkspaceDiscovery([tmpDir]);
    const contextEngine = new ContextEngine(discovery);

    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(
      extensionUri,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    provider.postMessageToWebview = (msg: any) => {
      if (msg.type === 'agent.approval_requested') {
        // Mutate the disk file concurrently before approval!
        fs.writeFileSync(apiFile, 'concurrent outside edit!\n', 'utf8');

        setTimeout(() => {
          provider.handleIncomingMessage({
            type: 'agent.approve',
            payload: { proposalId: msg.payload.proposalId },
          });
        }, 10);
      }
      return Promise.resolve(true);
    };

    await provider.handleIncomingMessage({
      type: 'user.submit',
      payload: {
        id: 'task_conflict',
        text: 'Update conflict.ts',
        timestamp: Date.now(),
      },
    });

    // The concurrent outside edit must NOT be overwritten by the proposed edit
    const diskContentAfter = fs.readFileSync(apiFile, 'utf8');
    expect(diskContentAfter).toBe('concurrent outside edit!\n');
  });

  it('supports cancellation during tool execution', async () => {
    const mockProvider = new MockModelProvider({
      turns: [
        {
          toolCall: {
            id: 'call_propose',
            name: 'propose_edit',
            arguments: {
              path: 'src/cancel.ts',
              proposedContent: 'cancelled content',
            },
          },
        },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const discovery = new WorkspaceDiscovery([tmpDir]);
    const contextEngine = new ContextEngine(discovery);

    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(
      extensionUri,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    let cancelledEmitted = false;
    eventBus.on('agent.cancelled', () => {
      cancelledEmitted = true;
    });

    provider.postMessageToWebview = (msg: any) => {
      if (msg.type === 'agent.approval_requested') {
        // Cancel the task instead of approving/rejecting
        provider.cancelActiveTask('User cancelled via UI');
      }
      return Promise.resolve(true);
    };

    await provider.handleIncomingMessage({
      type: 'user.submit',
      payload: {
        id: 'task_cancelled',
        text: 'Create cancel.ts',
        timestamp: Date.now(),
      },
    });

    expect(cancelledEmitted).toBe(true);
    expect(provider.currentStatus).toBe('CANCELLED');
    expect(fs.existsSync(path.join(tmpDir, 'src', 'cancel.ts'))).toBe(false);
  });

  it('enforces loop guards: prevents infinite loops by halting when max tool call limit is reached', async () => {
    // Generate 25 tool calls (exceeding MAX_TOOL_CALLS = 20)
    const infiniteTurns = Array.from({ length: 25 }, (_, i) => ({
      toolCall: {
        id: `call_loop_${i}`,
        name: 'search_code',
        arguments: { query: `term_${i}` },
      },
    }));

    const mockProvider = new MockModelProvider({
      turns: infiniteTurns,
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const discovery = new WorkspaceDiscovery([tmpDir]);
    const contextEngine = new ContextEngine(discovery);

    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(
      extensionUri,
      eventBus,
      modelGateway,
      undefined,
      contextEngine,
      docStore,
    );

    let errorReceived: any = null;
    provider.postMessageToWebview = (msg: any) => {
      if (msg.type === 'agent.error') {
        errorReceived = msg.payload;
      }
      return Promise.resolve(true);
    };

    await provider.handleIncomingMessage({
      type: 'user.submit',
      payload: {
        id: 'task_loop_guard',
        text: 'Infinite tool call prompt',
        timestamp: Date.now(),
      },
    });

    expect(errorReceived).toBeDefined();
    expect(errorReceived.message).toMatch(/maximum (tool call|loop iterations)/);
    expect(provider.currentStatus).toBe('ERROR');
  });
});
