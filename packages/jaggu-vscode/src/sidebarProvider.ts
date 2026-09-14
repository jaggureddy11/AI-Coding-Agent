import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import {
  EventBus,
  UiAgentStatus,
  ModelGateway,
  ModelMessage,
  ModelError,
  ContextEngine,
  ContextPackage,
  ActiveEditorContext,
  WorkspaceDiscovery,
  ToolExecutor,
  ReadFileTool,
  SearchCodeTool,
  ListDirectoryTool,
  ProposeEditTool,
  ApplyEditTool,
  RunTestsTool,
  RipgrepSearchService,
  InMemoryVirtualDocStore,
  ProposedEditRecord,
  IToolExecutionContext,
  AgentOrchestrator,
  Planner,
  EditSetManager,
  VerificationEngine,
  Plan,
  EditSet,
  EditApprovalDecision,
  TaskCheckpointManager,
} from '@jaggu/core';
import {
  isValidWebviewMessage,
  WebviewToExtensionMessage,
  ExtensionToWebviewMessage,
} from '@jaggu/ui';
import { CredentialManager } from './credentials.js';
import { VSCodeDiagnosticsProvider } from './diagnostics/vscodeDiagnosticsProvider.js';

export class JagguSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = 'jaggu.sidebarView';
  private _view?: vscode.WebviewView;
  private _currentStatus: UiAgentStatus = 'IDLE';
  private _activeAbortController?: AbortController;
  private _statusResetTimer?: NodeJS.Timeout;
  private _contextEngine?: ContextEngine;
  private _activeTaskId?: string;
  private readonly _docStore: InMemoryVirtualDocStore;
  private readonly _proposalRegistry = new Map<string, ProposedEditRecord>();
  private readonly _proposeEditTool: ProposeEditTool;
  private readonly _applyEditTool: ApplyEditTool;
  private readonly _toolExecutor: ToolExecutor;
  private readonly _pendingApprovals = new Map<string, (approved: boolean) => void>();
  private readonly _pendingPlanApprovals = new Map<string, (approved: boolean) => void>();
  private readonly _pendingEditSetApprovals = new Map<string, (decision: boolean | EditApprovalDecision) => void>();
  private readonly _pendingScopeApprovals = new Map<string, (approved: boolean) => void>();

  private readonly _onDidChangeStatus = new vscode.EventEmitter<{
    state: UiAgentStatus;
    detail?: string;
  }>();
  public readonly onDidChangeStatus = this._onDidChangeStatus.event;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _eventBus: EventBus,
    private readonly _modelGateway: ModelGateway = new ModelGateway(),
    private readonly _credentialManager?: CredentialManager,
    contextEngine?: ContextEngine,
    docStore?: InMemoryVirtualDocStore,
  ) {
    this._contextEngine = contextEngine;
    this._docStore = docStore || new InMemoryVirtualDocStore();
    this._proposeEditTool = new ProposeEditTool(this._docStore, this._eventBus, this._proposalRegistry);
    this._applyEditTool = new ApplyEditTool(this._docStore, this._proposalRegistry, this._eventBus);

    this._toolExecutor = new ToolExecutor({ eventBus: this._eventBus });
    this._toolExecutor.registerTool(new ReadFileTool());
    this._toolExecutor.registerTool(new SearchCodeTool(new RipgrepSearchService()));
    this._toolExecutor.registerTool(new ListDirectoryTool());
    this._toolExecutor.registerTool(this._proposeEditTool);
    this._toolExecutor.registerTool(this._applyEditTool);
    this._toolExecutor.registerTool(new RunTestsTool());
  }

  public getToolExecutor(): ToolExecutor {
    return this._toolExecutor;
  }

  public getDocStore(): InMemoryVirtualDocStore {
    return this._docStore;
  }

  public async openDiffPreview(filePath: string): Promise<void> {
    try {
      const originalUri = vscode.Uri.file(filePath);
      const shadowUri = vscode.Uri.parse(`jaggu-shadow:${filePath}`);
      const title = `${path.basename(filePath)} (Working Tree ↔ Proposed Changes)`;
      await vscode.commands.executeCommand('vscode.diff', originalUri, shadowUri, title);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to open diff preview: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  public getContextEngine(): ContextEngine {
    if (!this._contextEngine) {
      const workspaceRoots = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) || [];
      const discovery = new WorkspaceDiscovery(workspaceRoots);
      this._contextEngine = new ContextEngine(discovery);
    }
    return this._contextEngine;
  }

  public createOrchestrator(workspaceRoots: string[]): AgentOrchestrator {
    const editSetManager = new EditSetManager(this._docStore, this._eventBus, workspaceRoots);
    const verificationEngine = new VerificationEngine({
      toolExecutor: this._toolExecutor,
      eventBus: this._eventBus,
      workspaceRoots,
    });
    const planner = new Planner({
      modelGateway: this._modelGateway,
      eventBus: this._eventBus,
      workspaceRoots,
    });
    const diagnosticsProvider = new VSCodeDiagnosticsProvider({
      workspaceRoot: workspaceRoots[0] || '',
    });
    const taskCheckpointManager = new TaskCheckpointManager({
      workspaceRoots,
    });

    return new AgentOrchestrator({
      modelGateway: this._modelGateway,
      toolExecutor: this._toolExecutor,
      editSetManager,
      verificationEngine,
      planner,
      contextEngine: this.getContextEngine(),
      eventBus: this._eventBus,
      workspaceRoots,
      diagnosticsProvider,
      taskCheckpointManager,
      onRequestPlanApproval: async (plan: Plan) => {
        this._setStatus('PROCESSING', 'Engineering plan ready — awaiting user approval');
        this.postMessageToWebview({
          type: 'agent.plan_requested',
          payload: {
            taskId: this._activeTaskId || 'current',
            planId: plan.id,
            goal: plan.goal,
            steps: plan.steps.map((s) => ({
              id: s.id,
              description: s.description,
              files: s.files,
            })),
            risks: plan.risks,
            verification: plan.verification,
          },
        });

        return new Promise<boolean>((resolve) => {
          this._pendingPlanApprovals.set(plan.id, resolve);
        });
      },
      onRequestEditApproval: async (editSet: EditSet) => {
        this._setStatus('PROCESSING', `Change set ready (${editSet.files.length} files) — awaiting user review`);
        this.postMessageToWebview({
          type: 'agent.editset_requested',
          payload: {
            taskId: this._activeTaskId || 'current',
            editSetId: editSet.id,
            files: editSet.files.map((f) => ({
              relativePath: f.relativePath,
              shadowUri: f.shadowUri,
              isNew: f.isNewFile,
            })),
          },
        });

        return new Promise<boolean | EditApprovalDecision>((resolve) => {
          this._pendingEditSetApprovals.set(editSet.id, resolve);
        });
      },
      onRequestScopeApproval: async (unplannedFiles: string[]) => {
        this.postMessageToWebview({
          type: 'agent.scope_change_requested',
          payload: {
            taskId: this._activeTaskId || 'current',
            unplannedFiles,
            reason: `Proposed changes affect files not included in the approved engineering plan.`,
          },
        });

        return new Promise<boolean>((resolve) => {
          this._pendingScopeApprovals.set(this._activeTaskId || 'current', resolve);
        });
      },
      onActivity: (activity: string) => {
        this._setStatus('PROCESSING', activity);
        this.postMessageToWebview({
          type: 'agent.activity',
          payload: { message: activity },
        });
      },
    });
  }

  public get currentStatus(): UiAgentStatus {
    return this._currentStatus;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'media'),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((rawMessage: unknown) => {
      this.handleIncomingMessage(rawMessage);
    });
  }

  /**
   * Dispatches and handles incoming RPC messages from the Webview with strict schema validation.
   */
  public async handleIncomingMessage(rawMessage: unknown): Promise<void> {
    if (!isValidWebviewMessage(rawMessage)) {
      this.postMessageToWebview({
        type: 'agent.error',
        payload: {
          code: 'INVALID_RPC_PAYLOAD',
          message: 'Malformed or invalid message format received by Extension Host.',
        },
      });
      return;
    }

    const message = rawMessage as WebviewToExtensionMessage;

    switch (message.type) {
      case 'ui.ready': {
        const providerId = this._credentialManager?.getActiveProvider() || 'mock';
        const modelId = this._credentialManager?.getActiveModel() || '';
        this.postMessageToWebview({
          type: 'agent.config',
          payload: { provider: providerId, model: modelId },
        });
        this.postMessageToWebview({
          type: 'agent.status',
          payload: { state: this._currentStatus, detail: 'Ready' },
        });
        break;
      }

      case 'user.submit': {
        const { id, text, timestamp } = message.payload;
        await this.processUserPrompt(id, text, timestamp);
        break;
      }

      case 'SUBMIT_PROMPT': {
        const prompt = message.payload.prompt;
        const now = Date.now();
        await this.processUserPrompt(`task_${now}`, prompt, now);
        break;
      }

      case 'agent.cancel':
      case 'CANCEL_ACTIVE_TASK': {
        this.cancelActiveTask('Cancelled by user');
        break;
      }

      case 'agent.approve': {
        const { proposalId } = message.payload;
        const record = this._proposalRegistry.get(proposalId);
        if (record) {
          record.approved = true;
        }
        const resolver = this._pendingApprovals.get(proposalId);
        if (resolver) {
          resolver(true);
          this._pendingApprovals.delete(proposalId);
        }
        this._eventBus.emit('edit.approved', {
          taskId: this._activeTaskId || 'current',
          proposalId,
          filePath: record?.filePath || '',
          timestamp: Date.now(),
        });
        break;
      }

      case 'agent.reject': {
        const { proposalId, reason } = message.payload;
        const record = this._proposalRegistry.get(proposalId);
        if (record) {
          record.approved = false;
        }
        const resolver = this._pendingApprovals.get(proposalId);
        if (resolver) {
          resolver(false);
          this._pendingApprovals.delete(proposalId);
        }
        this._eventBus.emit('edit.rejected', {
          taskId: this._activeTaskId || 'current',
          proposalId,
          filePath: record?.filePath || '',
          reason,
          timestamp: Date.now(),
        });
        break;
      }

      case 'agent.review_diff': {
        const { filePath } = message.payload;
        await this.openDiffPreview(filePath);
        break;
      }

      case 'agent.plan_approve': {
        const { planId } = message.payload;
        const resolver = this._pendingPlanApprovals.get(planId);
        if (resolver) {
          resolver(true);
          this._pendingPlanApprovals.delete(planId);
        }
        this._eventBus.emit('plan.approved', {
          taskId: this._activeTaskId || 'current',
          planId,
          timestamp: Date.now(),
        });
        break;
      }

      case 'agent.plan_reject': {
        const { planId, reason } = message.payload;
        const resolver = this._pendingPlanApprovals.get(planId);
        if (resolver) {
          resolver(false);
          this._pendingPlanApprovals.delete(planId);
        }
        this._eventBus.emit('plan.rejected', {
          taskId: this._activeTaskId || 'current',
          planId,
          reason,
          timestamp: Date.now(),
        });
        break;
      }

      case 'agent.editset_approve': {
        const { editSetId, approvedFiles, rejectedFiles } = message.payload;
        const resolver = this._pendingEditSetApprovals.get(editSetId);
        if (resolver) {
          resolver({
            approved: true,
            approvedFiles,
            rejectedFiles,
          });
          this._pendingEditSetApprovals.delete(editSetId);
        }
        this._eventBus.emit('editset.approved', {
          editSetId,
          timestamp: Date.now(),
        });
        break;
      }

      case 'agent.editset_reject': {
        const { editSetId, reason } = message.payload;
        const resolver = this._pendingEditSetApprovals.get(editSetId);
        if (resolver) {
          resolver({
            approved: false,
          });
          this._pendingEditSetApprovals.delete(editSetId);
        }
        this._eventBus.emit('editset.rejected', {
          editSetId,
          reason,
          timestamp: Date.now(),
        });
        break;
      }

      case 'agent.scope_approve': {
        const taskId = message.payload?.taskId || this._activeTaskId || 'current';
        const resolver = this._pendingScopeApprovals.get(taskId);
        if (resolver) {
          resolver(true);
          this._pendingScopeApprovals.delete(taskId);
        }
        break;
      }

      case 'agent.scope_reject': {
        const taskId = message.payload?.taskId || this._activeTaskId || 'current';
        const resolver = this._pendingScopeApprovals.get(taskId);
        if (resolver) {
          resolver(false);
          this._pendingScopeApprovals.delete(taskId);
        }
        break;
      }

      case 'ui.clear': {
        for (const resolver of this._pendingApprovals.values()) {
          resolver(false);
        }
        this._pendingApprovals.clear();
        if (this._activeAbortController) {
          this._activeAbortController.abort();
          this._activeAbortController = undefined;
        }
        if (this._statusResetTimer) {
          clearTimeout(this._statusResetTimer);
          this._statusResetTimer = undefined;
        }
        this._setStatus('IDLE');
        break;
      }
    }
  }

  private async processUserPrompt(id: string, text: string, timestamp: number): Promise<void> {
    // 1. Abort previous in-flight task if any
    if (this._activeAbortController) {
      this._activeAbortController.abort();
      this._activeAbortController = undefined;
    }
    if (this._statusResetTimer) {
      clearTimeout(this._statusResetTimer);
      this._statusResetTimer = undefined;
    }

    this._activeAbortController = new AbortController();
    const abortSignal = this._activeAbortController.signal;

    // 2. Transition to PROCESSING state
    this._setStatus('PROCESSING', 'Analyzing workspace context...');
    this._eventBus.emit('agent.started', {
      taskId: id,
      conversationId: 'conv_main',
      prompt: text,
      timestamp,
    });

    // 3. Resolve active editor context if any
    let activeEditorContext: ActiveEditorContext | undefined;
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const doc = activeEditor.document;
      const selection = activeEditor.selection;
      const selectedText = doc.getText(selection);
      const cursorLine = selection.active.line;
      const startLine = Math.max(0, cursorLine - 20);
      const endLine = Math.min(doc.lineCount - 1, cursorLine + 20);

      activeEditorContext = {
        filePath: doc.uri.fsPath,
        languageId: doc.languageId,
        cursorLine: cursorLine + 1,
        selectedText: selectedText.trim().length > 0 ? selectedText : undefined,
        visibleLineRange: { start: startLine + 1, end: endLine + 1 },
      };
    }

    // 4. Discover and assemble bounded workspace context
    const contextEngine = this.getContextEngine();
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      contextEngine.setWorkspaceRoots(vscode.workspace.workspaceFolders.map((f) => f.uri.fsPath));
    }

    let contextPackage: ContextPackage | undefined;
    try {
      contextPackage = await contextEngine.assembleContext(
        text,
        activeEditorContext,
        abortSignal,
        this._eventBus,
        id,
      );

      if (abortSignal.aborted) {
        return;
      }

      if (contextPackage && contextPackage.provenance.length > 0) {
        this.postMessageToWebview({
          type: 'context.assembled',
          payload: {
            taskId: id,
            filesCount: contextPackage.filesCount,
            totalTokens: contextPackage.totalEstimatedTokens,
            provenance: contextPackage.provenance,
          },
        });
        this._setStatus(
          'PROCESSING',
          `Grounded with ${contextPackage.filesCount} workspace file(s)...`,
        );
      }
    } catch (ctxErr: unknown) {
      if (abortSignal.aborted) return;
      this._eventBus.emit('context.error', {
        taskId: id,
        error: ctxErr instanceof Error ? ctxErr.message : String(ctxErr),
        timestamp: Date.now(),
      });
    }

    // 5. Resolve active provider and credentials
    const providerId = this._credentialManager?.getActiveProvider() || 'mock';
    const model = this._credentialManager?.getActiveModel() || undefined;
    let apiKey: string | undefined;

    try {
      apiKey = await this._credentialManager?.getApiKey(providerId);
    } catch {
      // ignore
    }

    if (!apiKey && providerId !== 'mock' && providerId !== 'ollama') {
      this.postMessageToWebview({
        type: 'agent.error',
        payload: {
          code: 'MISSING_API_KEY',
          message: `API key for [${providerId}] is not configured. Use command "JAGGU: Set API Key" or switch to "mock" provider.`,
        },
      });
      this._setStatus('ERROR', 'API key missing');
      return;
    }

    const systemPromptParts = [
      'You are JAGGU, an autonomous AI coding agent designed to assist with software engineering tasks in this workspace.',
      'Always refer to the actual repository structure and provided files to answer questions accurately and concisely.',
    ];
    if (contextPackage && contextPackage.promptContextText) {
      systemPromptParts.push(contextPackage.promptContextText);
    }
    const systemPrompt = systemPromptParts.join('\n\n');

    const messages: ModelMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      { role: 'user', content: text },
    ];

    this._activeTaskId = id;
    const messageId = `asst_${Date.now()}`;
    let fullResponseText = '';

    const engineRoots = this.getContextEngine().getWorkspaceRoots();
    const vscodeRoots = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) || [];
    const workspaceRoots = vscodeRoots.length > 0 ? vscodeRoots : (engineRoots.length > 0 ? engineRoots : [process.cwd()]);
    const workspaceRoot = workspaceRoots[0] || process.cwd();
    const toolCtx: IToolExecutionContext = {
      taskId: id,
      workspaceRoot,
      workspaceRoots,
      abortSignal,
    };

    const MAX_ITERATIONS = 10;
    const MAX_TOOL_CALLS = 20;
    let iteration = 0;
    let totalToolCalls = 0;
    let loopFinished = false;

    try {
      while (!loopFinished && iteration < MAX_ITERATIONS) {
        if (abortSignal.aborted) break;
        iteration++;

        let turnHasToolCall = false;
        let currentToolCall: { id: string; name: string; arguments: Record<string, unknown> } | undefined;
        let turnTokens = '';

        const stream = this._modelGateway.streamChat(
          providerId,
          messages,
          {
            model: model || this._modelGateway.getProvider(providerId).defaultModel,
            apiKey,
            baseUrl: providerId === 'ollama' ? this._credentialManager?.getOllamaBaseUrl() : undefined,
            temperature: this._credentialManager?.getTemperature() ?? 0.2,
            abortSignal,
            tools: this._toolExecutor.toModelToolDefinitions(),
          },
          this._eventBus,
          id,
        );

        for await (const chunk of stream) {
          if (abortSignal.aborted) break;

          if (chunk.type === 'token') {
            turnTokens += chunk.text;
            fullResponseText += chunk.text;
            this.postMessageToWebview({
              type: 'token.delta',
              payload: {
                text: chunk.text,
                messageId,
              },
            });
          } else if (chunk.type === 'tool_call_complete') {
            turnHasToolCall = true;
            currentToolCall = {
              id: chunk.id,
              name: chunk.name,
              arguments: chunk.arguments,
            };
          }
        }

        if (abortSignal.aborted) break;

        // If turn has no tool call, the model has delivered its final textual response
        if (!turnHasToolCall || !currentToolCall) {
          loopFinished = true;
          break;
        }

        if (totalToolCalls >= MAX_TOOL_CALLS) {
          throw new Error(`Execution halted: maximum tool call limit (${MAX_TOOL_CALLS}) reached.`);
        }
        totalToolCalls++;

        // Activity message mapping
        const toolName = currentToolCall.name;
        const toolArgs = currentToolCall.arguments;
        let activityMsg = `Executing ${toolName}...`;

        if (toolName === 'search_code') {
          activityMsg = `Searching repository for "${toolArgs.query || ''}"...`;
        } else if (toolName === 'read_file') {
          activityMsg = `Reading ${toolArgs.filePath || ''}...`;
        } else if (toolName === 'list_directory') {
          activityMsg = `Listing directory ${toolArgs.directoryPath || '.'}...`;
        } else if (toolName === 'propose_edit') {
          activityMsg = `Preparing changes for ${toolArgs.filePath || ''}...`;
        } else if (toolName === 'apply_edit') {
          activityMsg = `Applying changes...`;
        } else if (toolName === 'run_tests') {
          activityMsg = `Running tests...`;
        }

        this._setStatus('PROCESSING', activityMsg);
        this.postMessageToWebview({
          type: 'agent.activity',
          payload: { message: activityMsg },
        });

        // Record assistant turn with tool call
        messages.push({
          role: 'assistant',
          content: turnTokens,
          toolCalls: [
            {
              id: currentToolCall.id,
              name: currentToolCall.name,
              arguments: JSON.stringify(currentToolCall.arguments),
            },
          ],
        });

        // Mutating tool handling (propose_edit requires human approval before apply)
        if (toolName === 'propose_edit') {
          const proposeResult = await this._toolExecutor.executeTool(
            currentToolCall.id,
            'propose_edit',
            toolArgs,
            toolCtx,
          );

          if (!proposeResult.success || !proposeResult.data) {
            messages.push({
              role: 'tool',
              toolCallId: currentToolCall.id,
              name: currentToolCall.name,
              content: JSON.stringify(proposeResult),
            });
            continue;
          }

          const proposal = proposeResult.data as ProposedEditRecord;

          // Post approval request to Webview
          this._setStatus('PROCESSING', 'Waiting for user approval...');
          this.postMessageToWebview({
            type: 'agent.approval_requested',
            payload: {
              proposalId: proposal.proposalId,
              filePath: proposal.filePath,
              diffSummary: proposal.diffSummary,
              timestamp: Date.now(),
            },
          });
          this.postMessageToWebview({
            type: 'agent.activity',
            payload: { message: `Waiting for approval on ${proposal.filePath}` },
          });

          if (abortSignal.aborted) break;

          // Wait for user approval or rejection
          const approved = await new Promise<boolean>((resolve) => {
            if (abortSignal.aborted) {
              resolve(false);
              return;
            }
            this._pendingApprovals.set(proposal.proposalId, resolve);
            const onAbort = () => {
              this._pendingApprovals.delete(proposal.proposalId);
              resolve(false);
            };
            abortSignal.addEventListener('abort', onAbort, { once: true });
          });

          if (abortSignal.aborted) break;

          if (approved) {
            this._setStatus('PROCESSING', `Applying changes to ${proposal.filePath}...`);
            this.postMessageToWebview({
              type: 'agent.activity',
              payload: { message: `Applying changes to ${proposal.filePath}...` },
            });

            const applyResult = await this._toolExecutor.executeTool(
              `${currentToolCall.id}_apply`,
              'apply_edit',
              { proposalId: proposal.proposalId },
              toolCtx,
            );

            messages.push({
              role: 'tool',
              toolCallId: currentToolCall.id,
              name: currentToolCall.name,
              content: JSON.stringify({
                proposal: proposeResult,
                applyResult,
                applied: applyResult.success,
              }),
            });
          } else {
            this._setStatus('PROCESSING', `Edit proposal rejected by user.`);
            this.postMessageToWebview({
              type: 'agent.activity',
              payload: { message: `Changes rejected by user.` },
            });

            messages.push({
              role: 'tool',
              toolCallId: currentToolCall.id,
              name: currentToolCall.name,
              content: JSON.stringify({
                success: false,
                rejected: true,
                message: 'User reviewed the diff and rejected this change. Do not apply it.',
              }),
            });
          }
        } else {
          // Execute SAFE or EXECUTION tool
          const result = await this._toolExecutor.executeTool(
            currentToolCall.id,
            currentToolCall.name,
            currentToolCall.arguments,
            toolCtx,
          );

          if (toolName === 'run_tests') {
            const testData = result.data as { exitCode?: number; stdout?: string } | undefined;
            const passed = testData?.exitCode === 0;
            const testMsg = passed ? 'Tests passed' : 'Tests failed';
            this.postMessageToWebview({
              type: 'agent.activity',
              payload: { message: testMsg },
            });
          }

          messages.push({
            role: 'tool',
            toolCallId: currentToolCall.id,
            name: currentToolCall.name,
            content: JSON.stringify(result),
          });
        }
      }

      if (!loopFinished && iteration >= MAX_ITERATIONS) {
        throw new Error(`Execution halted: maximum loop iterations (${MAX_ITERATIONS}) reached without concluding.`);
      }

      if (!abortSignal.aborted) {
        this.postMessageToWebview({
          type: 'token.complete',
          payload: {
            messageId,
            fullText: fullResponseText,
            provenance: contextPackage?.provenance,
          },
        });

        this._setStatus('SUCCESS', 'Task completed');

        this._statusResetTimer = setTimeout(() => {
          this._setStatus('IDLE', 'Ready');
          this._statusResetTimer = undefined;
        }, 1500);
      }
    } catch (error: unknown) {
      if (abortSignal.aborted || (error instanceof ModelError && error.code === 'CANCELLED')) {
        // Handled in cancelActiveTask
        return;
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      this.postMessageToWebview({
        type: 'agent.error',
        payload: {
          code: error instanceof ModelError ? error.code : 'MODEL_ERROR',
          message: errMsg,
        },
      });
      this._setStatus('ERROR', 'Error occurred');
    } finally {
      this._activeAbortController = undefined;
    }
  }

  public cancelActiveTask(reason: string): void {
    for (const resolver of this._pendingApprovals.values()) {
      resolver(false);
    }
    this._pendingApprovals.clear();

    if (this._activeAbortController) {
      this._activeAbortController.abort();
      this._activeAbortController = undefined;
    }
    if (this._statusResetTimer) {
      clearTimeout(this._statusResetTimer);
      this._statusResetTimer = undefined;
    }

    this._eventBus.emit('agent.cancelled', {
      taskId: 'active',
      reason,
      timestamp: Date.now(),
    });

    this.postMessageToWebview({
      type: 'agent.message',
      payload: {
        id: `sys_${Date.now()}`,
        role: 'system',
        text: `[${reason}]`,
        timestamp: Date.now(),
      },
    });

    this._setStatus('CANCELLED', reason);

    this._statusResetTimer = setTimeout(() => {
      this._setStatus('IDLE', 'Ready');
      this._statusResetTimer = undefined;
    }, 1000);
  }

  private _setStatus(state: UiAgentStatus, detail?: string): void {
    this._currentStatus = state;
    this._onDidChangeStatus.fire({ state, detail });
    this.postMessageToWebview({
      type: 'agent.status',
      payload: { state, detail },
    });
  }

  public postMessageToWebview(message: ExtensionToWebviewMessage): Thenable<boolean> | undefined {
    return this._view?.webview.postMessage(message);
  }

  public getHtmlForWebview(webview: vscode.Webview): string {
    return this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.css'),
    );

    const nonce = crypto.randomBytes(16).toString('base64');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JAGGU</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
