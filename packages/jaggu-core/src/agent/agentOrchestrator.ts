import * as crypto from 'crypto';
import { AgentStateMachine } from './fsm.js';
import { AgentState, DEFAULT_LOOP_LIMITS, LoopGuardLimits } from '../types/state.js';
import { ModelGateway } from '../models/gateway.js';
import { ModelMessage } from '../types/models.js';
import { ToolExecutor } from '../tools/executor.js';
import { EditSetManager, CreateEditFileInput } from '../diff/editSetManager.js';
import { VerificationEngine } from '../verification/verificationEngine.js';
import { Planner } from '../planning/planner.js';
import { ContextEngine } from '../context/engine.js';
import { EventBus } from '../events/eventBus.js';
import { Plan } from '../types/plan.js';
import { EditSet, EditApprovalDecision } from '../types/editSet.js';
import { VerificationResult } from '../types/verification.js';
import { IDiagnosticsProvider, DiagnosticsSummary, summarizeDiagnostics } from '../types/diagnostics.js';
import { TaskCheckpointManager } from '../git/taskCheckpointManager.js';
import { TaskGitBaseline, TaskGitDiffSummary } from '../types/git.js';

export interface AgentOrchestratorOptions {
  modelGateway: ModelGateway;
  toolExecutor: ToolExecutor;
  editSetManager: EditSetManager;
  verificationEngine: VerificationEngine;
  planner: Planner;
  contextEngine: ContextEngine;
  eventBus: EventBus;
  workspaceRoots: string[];
  limits?: LoopGuardLimits;
  diagnosticsProvider?: IDiagnosticsProvider;
  taskCheckpointManager?: TaskCheckpointManager;
  onRequestPlanApproval: (plan: Plan) => Promise<boolean>;
  onRequestEditApproval: (editSet: EditSet) => Promise<boolean | EditApprovalDecision>;
  onRequestScopeApproval?: (unplannedFiles: string[]) => Promise<boolean>;
  onActivity?: (activity: string) => void;
}

export interface AgentTaskResult {
  success: boolean;
  taskId: string;
  plan?: Plan;
  appliedFiles: string[];
  rejectedFiles?: string[];
  verificationResult?: VerificationResult;
  diagnosticsSummary?: DiagnosticsSummary;
  taskGitSummary?: TaskGitDiffSummary;
  suggestedCommitMessage?: string;
  baseline?: TaskGitBaseline;
  summary: string;
  repairCount: number;
}

export class AgentOrchestrator {
  private readonly modelGateway: ModelGateway;
  private readonly toolExecutor: ToolExecutor;
  private readonly editSetManager: EditSetManager;
  private readonly verificationEngine: VerificationEngine;
  private readonly planner: Planner;
  private readonly contextEngine: ContextEngine;
  private readonly eventBus: EventBus;
  private readonly workspaceRoots: string[];
  private readonly limits: LoopGuardLimits;
  private readonly diagnosticsProvider?: IDiagnosticsProvider;
  private readonly taskCheckpointManager?: TaskCheckpointManager;
  private readonly onRequestPlanApproval: (plan: Plan) => Promise<boolean>;
  private readonly onRequestEditApproval: (editSet: EditSet) => Promise<boolean | EditApprovalDecision>;
  private readonly onRequestScopeApproval?: (unplannedFiles: string[]) => Promise<boolean>;
  private readonly onActivity?: (activity: string) => void;

  constructor(options: AgentOrchestratorOptions) {
    this.modelGateway = options.modelGateway;
    this.toolExecutor = options.toolExecutor;
    this.editSetManager = options.editSetManager;
    this.verificationEngine = options.verificationEngine;
    this.planner = options.planner;
    this.contextEngine = options.contextEngine;
    this.eventBus = options.eventBus;
    this.workspaceRoots = options.workspaceRoots;
    this.limits = options.limits ?? DEFAULT_LOOP_LIMITS;
    this.diagnosticsProvider = options.diagnosticsProvider;
    this.taskCheckpointManager = options.taskCheckpointManager;
    this.onRequestPlanApproval = options.onRequestPlanApproval;
    this.onRequestEditApproval = options.onRequestEditApproval;
    this.onRequestScopeApproval = options.onRequestScopeApproval;
    this.onActivity = options.onActivity;
  }

  public getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }

  public getWorkspaceRoots(): string[] {
    return this.workspaceRoots;
  }

  public async executeTask(
    userPrompt: string,
    options: {
      providerId?: string;
      model?: string;
      abortSignal?: AbortSignal;
    } = {},
  ): Promise<AgentTaskResult> {
    const taskId = `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const fsm = new AgentStateMachine(taskId, this.eventBus, this.limits);
    const providerId = options.providerId ?? 'mock';
    const abortSignal = options.abortSignal;

    this.eventBus.emit('agent.started', {
      taskId,
      conversationId: 'default',
      prompt: userPrompt,
      timestamp: Date.now(),
    });

    try {
      // --- 1. UNDERSTANDING ---
      fsm.transitionTo(AgentState.UNDERSTANDING);
      this.onActivity?.('Understanding repository…');

      if (abortSignal?.aborted) throw new Error('Task cancelled');

      const contextPackage = await this.contextEngine.assembleContext(
        userPrompt,
        undefined,
        abortSignal,
        this.eventBus,
        taskId,
      );

      // --- 2. PLANNING ---
      fsm.transitionTo(AgentState.PLANNING);
      this.onActivity?.('Formulating engineering plan…');

      if (abortSignal?.aborted) throw new Error('Task cancelled');

      const planResult = await this.planner.createPlan(userPrompt, contextPackage, abortSignal);
      if (!planResult.success || !planResult.plan) {
        fsm.transitionTo(AgentState.FAILED);
        return {
          success: false,
          taskId,
          appliedFiles: [],
          summary: `Planning failed: ${planResult.errors?.join('; ') || 'Unknown error'}`,
          repairCount: 0,
        };
      }

      const plan = planResult.plan;

      // --- 3. PLAN_REVIEW ---
      fsm.transitionTo(AgentState.PLAN_REVIEW);
      this.onActivity?.('Plan ready — review required');

      this.eventBus.emit('plan.approval_requested', {
        taskId,
        planId: plan.id,
        goal: plan.goal,
        steps: plan.steps.map((s) => ({
          id: s.id,
          description: s.description,
          files: [...(s.files || []), ...(s.newFiles || [])],
        })),
        risks: plan.risks,
        verification: plan.verification,
        timestamp: Date.now(),
      });

      const planApproved = await this.onRequestPlanApproval(plan);
      if (!planApproved) {
        this.eventBus.emit('plan.rejected', {
          taskId,
          planId: plan.id,
          reason: 'User rejected plan',
          timestamp: Date.now(),
        });
        fsm.transitionTo(AgentState.FAILED);
        return {
          success: false,
          taskId,
          plan,
          appliedFiles: [],
          summary: 'Task was halted because the engineering plan was rejected.',
          repairCount: 0,
        };
      }

      this.eventBus.emit('plan.approved', {
        taskId,
        planId: plan.id,
        timestamp: Date.now(),
      });

      // Track approved scope of files
      const approvedFiles = new Set<string>();
      for (const s of plan.steps) {
        (s.files || []).forEach((f) => approvedFiles.add(f));
        (s.newFiles || []).forEach((f: string) => approvedFiles.add(f));
      }

      // --- 3.5. GIT BASELINE CHECKPOINT ---
      let baseline: TaskGitBaseline | undefined;
      if (this.taskCheckpointManager) {
        this.onActivity?.('Capturing Git task baseline & inspecting worktree…');
        try {
          baseline = await this.taskCheckpointManager.captureBaseline(taskId);
          const preExisting = this.taskCheckpointManager.detectPreExistingModifications(Array.from(approvedFiles), baseline);
          if (preExisting.hasPreExistingChanges) {
            this.onActivity?.(`⚠️ Notice: ${preExisting.preExistingFiles.length} planned file(s) had pre-existing user modifications: ${preExisting.preExistingFiles.join(', ')}`);
          }
        } catch (err) {
          this.onActivity?.(`Git baseline skipped: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // --- 4. EXECUTING (Generate Changes) ---
      fsm.transitionTo(AgentState.EXECUTING);
      this.onActivity?.('Generating proposed modifications…');

      if (abortSignal?.aborted) throw new Error('Task cancelled');

      // Prompt model to produce the concrete changes for the plan
      const editInputs = await this.generateProposedChanges(userPrompt, plan, contextPackage, providerId, options.model, abortSignal);

      // Scope check
      const unplannedFiles = editInputs.filter((f) => !approvedFiles.has(f.relativePath)).map((f) => f.relativePath);
      if (unplannedFiles.length > 0) {
        this.eventBus.emit('agent.scope_change_requested', {
          taskId,
          unplannedFiles,
          reason: 'Model proposed modifications to files outside the approved plan.',
          timestamp: Date.now(),
        });

        if (this.onRequestScopeApproval) {
          const scopeApproved = await this.onRequestScopeApproval(unplannedFiles);
          if (!scopeApproved) {
            fsm.transitionTo(AgentState.FAILED);
            return {
              success: false,
              taskId,
              plan,
              appliedFiles: [],
              summary: `Scope change rejected by user for files: ${unplannedFiles.join(', ')}`,
              repairCount: 0,
              baseline,
            };
          }
        }
      }

      // Stage in EditSetManager
      const staged = this.editSetManager.createEditSet(editInputs, plan.id);
      if (!staged.success || !staged.editSet) {
        fsm.transitionTo(AgentState.FAILED);
        return {
          success: false,
          taskId,
          plan,
          appliedFiles: [],
          summary: `Failed to stage edits: ${staged.error}`,
          repairCount: 0,
          baseline,
        };
      }

      let activeEditSet = staged.editSet;

      // --- 5. EDIT_REVIEW (Selective / Partial Approval) ---
      fsm.transitionTo(AgentState.EDIT_REVIEW);
      this.onActivity?.(`Changes proposed for ${activeEditSet.files.length} file(s) — review required`);

      const editApprovalRaw = await this.onRequestEditApproval(activeEditSet);
      let editApproved = false;
      let approvedFilesFilter: string[] | undefined;
      let rejectedFilesList: string[] = [];

      if (typeof editApprovalRaw === 'boolean') {
        editApproved = editApprovalRaw;
      } else if (editApprovalRaw && typeof editApprovalRaw === 'object') {
        editApproved = editApprovalRaw.approved;
        if (editApprovalRaw.approvedFiles && editApprovalRaw.approvedFiles.length > 0) {
          approvedFilesFilter = editApprovalRaw.approvedFiles;
        }
        if (editApprovalRaw.rejectedFiles && editApprovalRaw.rejectedFiles.length > 0) {
          rejectedFilesList = editApprovalRaw.rejectedFiles;
        }
      }

      if (!editApproved) {
        this.editSetManager.rejectEditSet(activeEditSet.id, 'User rejected edit set');
        fsm.transitionTo(AgentState.EXECUTING);
        return {
          success: false,
          taskId,
          plan,
          appliedFiles: [],
          summary: 'Task was halted because the proposed edits were rejected.',
          repairCount: 0,
          baseline,
        };
      }

      this.eventBus.emit('editset.approved', {
        editSetId: activeEditSet.id,
        timestamp: Date.now(),
      });

      // --- 6. APPLYING (Selective Application) ---
      fsm.transitionTo(AgentState.APPLYING);
      this.onActivity?.('Applying approved changes to workspace…');

      const applyResult = this.editSetManager.applyEditSet(activeEditSet.id, true, approvedFilesFilter);
      if (!applyResult.success) {
        fsm.transitionTo(AgentState.FAILED);
        return {
          success: false,
          taskId,
          plan,
          appliedFiles: [],
          summary: `Failed to apply changes: ${applyResult.error}`,
          repairCount: 0,
          baseline,
        };
      }

      const allAppliedFiles = [...applyResult.appliedFiles];
      const allRejectedFiles = [...(applyResult.rejectedFiles ?? rejectedFilesList)];

      if (allRejectedFiles.length > 0) {
        this.onActivity?.(`Applied ${allAppliedFiles.length} file(s); preserved/skipped ${allRejectedFiles.length} rejected file(s).`);
      }

      // --- 6.5. LSP DIAGNOSTICS & DIAGNOSTIC REPAIR ---
      let diagnosticsSummary: DiagnosticsSummary | undefined;
      let repairCount = 0;

      if (this.diagnosticsProvider && allAppliedFiles.length > 0) {
        this.onActivity?.('Collecting compiler diagnostics for modified files…');
        try {
          const rawDiags = await this.diagnosticsProvider.getDiagnostics(allAppliedFiles);
          diagnosticsSummary = summarizeDiagnostics(rawDiags);
          if (diagnosticsSummary.errorCount > 0 && fsm.getRepairAttempts() < this.limits.maxRepairAttempts) {
            fsm.transitionTo(AgentState.DIAGNOSING);
            this.onActivity?.(`Compiler reported ${diagnosticsSummary.errorCount} error(s) — diagnosing and formulating fix…`);

            if (abortSignal?.aborted) throw new Error('Task cancelled');

            const diagnosticRepairEdits = await this.generateDiagnosticRepairChanges(
              plan,
              diagnosticsSummary,
              allAppliedFiles,
              providerId,
              options.model,
              abortSignal,
            );

            if (diagnosticRepairEdits.length > 0) {
              fsm.transitionTo(AgentState.EXECUTING);
              repairCount++;

              const diagStaged = this.editSetManager.createEditSet(diagnosticRepairEdits, plan.id);
              if (diagStaged.success && diagStaged.editSet) {
                const diagEditSet = diagStaged.editSet;
                fsm.transitionTo(AgentState.EDIT_REVIEW);
                this.onActivity?.(`Diagnostic corrective changes proposed for ${diagEditSet.files.length} file(s) — review required`);

                const diagApprovedRaw = await this.onRequestEditApproval(diagEditSet);
                const diagApproved = typeof diagApprovedRaw === 'boolean' ? diagApprovedRaw : diagApprovedRaw?.approved;
                const diagApprovedFilter = typeof diagApprovedRaw === 'object' ? diagApprovedRaw?.approvedFiles : undefined;

                if (diagApproved) {
                  fsm.transitionTo(AgentState.APPLYING);
                  this.onActivity?.('Applying diagnostic correction…');
                  const diagApply = this.editSetManager.applyEditSet(diagEditSet.id, true, diagApprovedFilter);
                  if (diagApply.success) {
                    for (const daf of diagApply.appliedFiles) {
                      if (!allAppliedFiles.includes(daf)) allAppliedFiles.push(daf);
                    }
                    // Refresh diagnostics after applying correction
                    const postDiags = await this.diagnosticsProvider.getDiagnostics(allAppliedFiles);
                    diagnosticsSummary = summarizeDiagnostics(postDiags);
                  }
                } else {
                  this.editSetManager.rejectEditSet(diagEditSet.id, 'User rejected diagnostic repair');
                }
              }
            }
          }
        } catch (err) {
          this.onActivity?.(`Diagnostics check skipped: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // --- 7. VERIFYING ---
      fsm.transitionTo(AgentState.VERIFYING);
      this.onActivity?.('Running test verification…');

      const verifyCmd = this.verificationEngine.determineVerificationCommand(plan.verification, allAppliedFiles);
      let verifyResult = await this.verificationEngine.runVerification(verifyCmd, abortSignal);

      // --- 8. TEST FAILURE / DIAGNOSIS & REPAIR LOOP ---
      while (verifyResult.status === 'FAIL' && fsm.getRepairAttempts() < this.limits.maxRepairAttempts) {
        fsm.transitionTo(AgentState.DIAGNOSING);
        this.onActivity?.(`Tests failed — diagnosing issue (attempt ${fsm.getRepairAttempts() + 1}/${this.limits.maxRepairAttempts})…`);

        if (abortSignal?.aborted) throw new Error('Task cancelled');

        // Formulate repair changes
        const repairEdits = await this.generateRepairChanges(
          plan,
          verifyResult,
          allAppliedFiles,
          providerId,
          options.model,
          abortSignal,
        );

        if (repairEdits.length === 0) {
          break;
        }

        fsm.transitionTo(AgentState.EXECUTING);
        repairCount++;

        const repairStaged = this.editSetManager.createEditSet(repairEdits, plan.id);
        if (!repairStaged.success || !repairStaged.editSet) {
          break;
        }

        activeEditSet = repairStaged.editSet;

        fsm.transitionTo(AgentState.EDIT_REVIEW);
        this.onActivity?.(`Repair changes ready for ${activeEditSet.files.length} file(s) — review required`);

        const repairApprovedRaw = await this.onRequestEditApproval(activeEditSet);
        const repairApproved = typeof repairApprovedRaw === 'boolean' ? repairApprovedRaw : repairApprovedRaw?.approved;
        const repairApprovedFilter = typeof repairApprovedRaw === 'object' ? repairApprovedRaw?.approvedFiles : undefined;

        if (!repairApproved) {
          this.editSetManager.rejectEditSet(activeEditSet.id, 'User rejected repair edit set');
          break;
        }

        fsm.transitionTo(AgentState.APPLYING);
        this.onActivity?.('Applying corrective repair changes…');

        const repairApply = this.editSetManager.applyEditSet(activeEditSet.id, true, repairApprovedFilter);
        if (!repairApply.success) {
          break;
        }

        for (const rf of repairApply.appliedFiles) {
          if (!allAppliedFiles.includes(rf)) allAppliedFiles.push(rf);
        }

        fsm.transitionTo(AgentState.VERIFYING);
        this.onActivity?.('Rerunning test verification…');

        verifyResult = await this.verificationEngine.runVerification(verifyCmd, abortSignal);
      }

      // Calculate Git task diff summary and suggested commit message
      let taskGitSummary: TaskGitDiffSummary | undefined;
      let suggestedCommitMessage: string | undefined;

      if (this.taskCheckpointManager && baseline) {
        try {
          taskGitSummary = this.taskCheckpointManager.calculateTaskSummary(baseline, allAppliedFiles);
          suggestedCommitMessage = this.taskCheckpointManager.generateSuggestedCommitMessage(plan.goal, allAppliedFiles);
        } catch {
          // Non-fatal if git error
        }
      }

      if (verifyResult.status === 'PASS') {
        fsm.transitionTo(AgentState.COMPLETED);
        this.onActivity?.('Task completed successfully.');

        const summary = `Task completed successfully.\n- Plan: ${plan.goal}\n- Files modified: ${allAppliedFiles.join(', ')}\n- Verification: ${verifyResult.summary || 'Tests passed'}${suggestedCommitMessage ? `\n- Suggested Commit: ${suggestedCommitMessage}` : ''}`;
        this.eventBus.emit('agent.completed', {
          taskId,
          summary,
          totalFilesChanged: allAppliedFiles.length,
          durationMs: 0,
          tokensUsed: 0,
          timestamp: Date.now(),
        });

        return {
          success: true,
          taskId,
          plan,
          appliedFiles: allAppliedFiles,
          rejectedFiles: allRejectedFiles.length > 0 ? allRejectedFiles : undefined,
          verificationResult: verifyResult,
          diagnosticsSummary,
          taskGitSummary,
          suggestedCommitMessage,
          baseline,
          summary,
          repairCount,
        };
      } else {
        fsm.transitionTo(AgentState.FAILED);
        this.onActivity?.('Verification failed.');
        return {
          success: false,
          taskId,
          plan,
          appliedFiles: allAppliedFiles,
          rejectedFiles: allRejectedFiles.length > 0 ? allRejectedFiles : undefined,
          verificationResult: verifyResult,
          diagnosticsSummary,
          taskGitSummary,
          suggestedCommitMessage,
          baseline,
          summary: `Task failed verification: ${verifyResult.summary || verifyResult.stderr}`,
          repairCount,
        };
      }
    } catch (err) {
      const isCancelled = abortSignal?.aborted || (err instanceof Error && err.message.includes('cancelled'));
      if (isCancelled) {
        if (fsm.getState() !== AgentState.CANCELLED && fsm.getState() !== AgentState.IDLE) {
          fsm.transitionTo(AgentState.CANCELLED);
        }
        this.onActivity?.('Task cancelled by user.');
        return {
          success: false,
          taskId,
          appliedFiles: [],
          summary: 'Task was cancelled by user.',
          repairCount: 0,
        };
      }

      if (fsm.getState() !== AgentState.FAILED) {
        fsm.transitionTo(AgentState.FAILED);
      }
      this.onActivity?.('Task encountered an unexpected error.');
      return {
        success: false,
        taskId,
        appliedFiles: [],
        summary: `Error executing task: ${err instanceof Error ? err.message : String(err)}`,
        repairCount: 0,
      };
    }
  }

  private async generateProposedChanges(
    _userPrompt: string,
    plan: Plan,
    _contextPackage: unknown,
    providerId: string,
    model?: string,
    abortSignal?: AbortSignal,
  ): Promise<CreateEditFileInput[]> {
    const prompt = `You are implementing the approved engineering plan.
Goal: ${plan.goal}
Steps:
${plan.steps.map((s) => `${s.id}: ${s.description} (Files: ${[...(s.files || []), ...(s.newFiles || [])].join(', ')})`).join('\n')}

Output a JSON array of files to write:
[
  {
    "relativePath": "src/path/to/file.ts",
    "proposedContent": "complete file content",
    "isNewFile": false
  }
]
`;

    const messages: ModelMessage[] = [
      { role: 'system', content: 'You are JAGGU code generator. Output ONLY a valid JSON array of file edits.' },
      { role: 'user', content: prompt },
    ];

    let content = '';
    const stream = this.modelGateway.streamChat(
      providerId,
      messages,
      {
        model: model || this.modelGateway.getProvider(providerId).defaultModel,
        temperature: 0.1,
        abortSignal,
      },
      this.eventBus,
    );

    for await (const chunk of stream) {
      if (chunk.type === 'token' && typeof chunk.text === 'string') {
        content += chunk.text;
      }
    }

    try {
      const parsed = this.extractJsonArray(content);
      if (Array.isArray(parsed)) {
        return parsed as CreateEditFileInput[];
      }
    } catch {
      // fallback
    }

    return [];
  }

  private async generateRepairChanges(
    plan: Plan,
    failure: VerificationResult,
    _modifiedFiles: string[],
    providerId: string,
    model?: string,
    abortSignal?: AbortSignal,
  ): Promise<CreateEditFileInput[]> {
    const prompt = `Verification failed for plan "${plan.goal}".
Test Output:
Command: ${failure.command}
Exit Code: ${failure.exitCode}
Stdout: ${failure.stdout}
Stderr: ${failure.stderr}

Please propose corrective changes to fix the test failures.
Output a JSON array of file edits:
[
  {
    "relativePath": "path/to/file.ts",
    "proposedContent": "complete updated content",
    "isNewFile": false
  }
]`;

    const messages: ModelMessage[] = [
      { role: 'system', content: 'You are JAGGU diagnosing a test failure. Output ONLY a valid JSON array of corrective file edits.' },
      { role: 'user', content: prompt },
    ];

    let content = '';
    const stream = this.modelGateway.streamChat(
      providerId,
      messages,
      {
        model: model || this.modelGateway.getProvider(providerId).defaultModel,
        temperature: 0.1,
        abortSignal,
      },
      this.eventBus,
    );

    for await (const chunk of stream) {
      if (chunk.type === 'token' && typeof chunk.text === 'string') {
        content += chunk.text;
      }
    }

    try {
      const parsed = this.extractJsonArray(content);
      if (Array.isArray(parsed)) {
        return parsed as CreateEditFileInput[];
      }
    } catch {
      // fallback
    }

    return [];
  }

  private async generateDiagnosticRepairChanges(
    plan: Plan,
    diagnostics: DiagnosticsSummary,
    _modifiedFiles: string[],
    providerId: string,
    model?: string,
    abortSignal?: AbortSignal,
  ): Promise<CreateEditFileInput[]> {
    const errorList = diagnostics.diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => `- ${d.file}:${d.line}:${d.column}: [${d.source ?? 'compiler'}] ${d.message}`)
      .join('\n');

    const prompt = `Compiler diagnostics reported errors after applying edits for plan "${plan.goal}":
${errorList}

Please propose corrective changes to resolve these compiler diagnostic errors.
Output a JSON array of file edits:
[
  {
    "relativePath": "path/to/file.ts",
    "proposedContent": "complete updated content",
    "isNewFile": false
  }
]`;

    const messages: ModelMessage[] = [
      { role: 'system', content: 'You are JAGGU diagnosing compiler diagnostic errors. Output ONLY a valid JSON array of corrective file edits.' },
      { role: 'user', content: prompt },
    ];

    let content = '';
    const stream = this.modelGateway.streamChat(
      providerId,
      messages,
      {
        model: model || this.modelGateway.getProvider(providerId).defaultModel,
        temperature: 0.1,
        abortSignal,
      },
      this.eventBus,
    );

    for await (const chunk of stream) {
      if (chunk.type === 'token' && typeof chunk.text === 'string') {
        content += chunk.text;
      }
    }

    try {
      const parsed = this.extractJsonArray(content);
      if (Array.isArray(parsed)) {
        return parsed as CreateEditFileInput[];
      }
    } catch {
      // fallback
    }

    return [];
  }

  private extractJsonArray(text?: string): unknown {
    if (!text) return null;
    const trimmed = text.trim();
    const normalize = (obj: unknown) => {
      if (Array.isArray(obj)) return obj;
      if (obj && typeof obj === 'object' && 'files' in obj && Array.isArray((obj as { files: unknown[] }).files)) {
        return (obj as { files: unknown[] }).files;
      }
      return null;
    };

    try {
      const direct = JSON.parse(trimmed);
      const normalized = normalize(direct);
      if (normalized) return normalized;
    } catch {
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          const normalized = normalize(parsed);
          if (normalized) return normalized;
        } catch {
          // fallback
        }
      }
      const firstBracket = trimmed.indexOf('[');
      const lastBracket = trimmed.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        try {
          return JSON.parse(trimmed.substring(firstBracket, lastBracket + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
    return null;
  }
}
