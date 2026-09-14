import * as fs from 'fs';
import * as path from 'path';
import {
  EventBus,
  ContextEngine,
  WorkspaceDiscovery,
  RipgrepSearchService,
  Planner,
  ToolExecutor,
  EditSetManager,
  InMemoryVirtualDocStore,
  VerificationEngine,
  TaskCheckpointManager,
  GitCliService,
  ModelGateway,
  IModelProvider,
  ModelMessage,
  ModelStreamChunk,
  ModelMetadata,
  ModelCapabilities,
  AgentOrchestrator,
  IDiagnosticsProvider,
  Diagnostic,
  ReadFileTool,
  SearchCodeTool,
  ListDirectoryTool,
  RunTestsTool,
} from '@jaggu/core';
import {
  BenchmarkTaskDefinition,
  RawEvaluationTaskResult,
  EvaluationScorecard,
  FailureCategory,
} from './types.js';
import { FixtureManager } from './fixtureManager.js';

export class DeterministicTaskProvider implements IModelProvider {
  public readonly id = 'mock' as const;
  public readonly name = 'Deterministic Benchmark Mock';
  public readonly defaultModel = 'mock-fast';

  public readonly supportedModels: ModelMetadata[] = [
    {
      id: 'mock-fast',
      displayName: 'Mock Fast Model',
      providerId: 'mock',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
      },
    },
  ];

  constructor(private readonly task: BenchmarkTaskDefinition) {}

  public getCapabilities(_model: string): ModelCapabilities {
    return this.supportedModels[0]!.capabilities;
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async *streamChat(
    messages: ModelMessage[],
  ): AsyncIterableIterator<ModelStreamChunk> {
    const promptText = messages.map((m) => m.content).join('\n');

    // 1. Planning prompt
    if (
      promptText.includes('senior software planning engine') ||
      promptText.includes('planning engine') ||
      promptText.includes('Planning Engine') ||
      promptText.includes('analyze the user request and repository context')
    ) {
      const plan = {
        id: this.task.mockResponses.plan.id || 'plan-1',
        goal: this.task.mockResponses.plan.goal,
        assumptions: this.task.mockResponses.plan.assumptions || ['Standard workspace layout'],
        steps: this.task.mockResponses.plan.steps.map((s, idx) => ({
          id: s.id || `step-${idx + 1}`,
          description: s.description,
          files: s.files || [],
          newFiles: s.newFiles || [],
          dependencies: s.dependencies || [],
          expectedOutcome: s.expectedOutcome || 'Step completed successfully',
          verification: s.verification || 'Unit tests pass',
          status: 'PENDING',
        })),
        risks: this.task.mockResponses.plan.risks || [],
        verification: Array.isArray(this.task.mockResponses.plan.verification)
          ? this.task.mockResponses.plan.verification
          : [this.task.mockResponses.plan.verification || 'npm test'],
      };
      yield { type: 'token', text: JSON.stringify(plan) };
      yield { type: 'usage', promptTokens: 100, completionTokens: 150 };
      return;
    }

    // 2. Diagnostic Repair prompt
    if (
      promptText.includes('Compiler diagnostics reported errors') ||
      promptText.includes('propose corrective changes to resolve these compiler diagnostic errors')
    ) {
      const repairs = this.task.mockResponses.diagnosticRepairs || [];
      yield { type: 'token', text: JSON.stringify(repairs) };
      yield { type: 'usage', promptTokens: 80, completionTokens: 120 };
      return;
    }

    // 3. Test Failure Repair prompt
    if (
      promptText.includes('Verification failed for plan') ||
      promptText.includes('diagnosing a test failure')
    ) {
      const repairs = this.task.mockResponses.testRepairs || [];
      yield { type: 'token', text: JSON.stringify(repairs) };
      yield { type: 'usage', promptTokens: 80, completionTokens: 120 };
      return;
    }

    // 4. Edit proposal prompt
    if (
      promptText.includes('Output a JSON array of files to write') ||
      promptText.includes('approved engineering plan')
    ) {
      const edits = this.task.mockResponses.edits;
      yield { type: 'token', text: JSON.stringify(edits) };
      yield { type: 'usage', promptTokens: 150, completionTokens: 300 };
      return;
    }

    // Default fallback
    yield { type: 'token', text: '[]' };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}

export class BenchmarkEvaluator {
  private readonly fixtureManager: FixtureManager;
  private readonly resultsDir: string;

  constructor(options: { fixturesBaseDir?: string; resultsDir?: string } = {}) {
    this.fixtureManager = new FixtureManager(options.fixturesBaseDir);
    if (options.resultsDir) {
      this.resultsDir = options.resultsDir;
    } else {
      const localCandidate = path.resolve(process.cwd(), 'results');
      const rootCandidate = path.resolve(process.cwd(), 'packages/jaggu-eval/results');
      this.resultsDir = fs.existsSync(path.resolve(process.cwd(), 'fixtures')) ? localCandidate : rootCandidate;
    }
  }

  public async evaluateTask(
    task: BenchmarkTaskDefinition,
  ): Promise<RawEvaluationTaskResult> {
    const startTime = Date.now();
    const prepared = this.fixtureManager.prepareWorkspace(task.fixtureDir, {
      requiresGit: task.requiresGit,
      preExistingDirtyFiles: task.preExistingDirtyFiles,
    });

    const workspaceRoot = prepared.workspaceRoot;
    const eventBus = new EventBus();

    let toolCallCount = 0;
    let readCount = 0;
    let searchCount = 0;
    let editCount = 0;
    let verificationCount = 0;

    eventBus.on('tool.requested', (e: { toolName: string }) => {
      toolCallCount++;
      if (e.toolName === 'read_file') readCount++;
      if (e.toolName === 'search_code' || e.toolName === 'list_directory') searchCount++;
      if (e.toolName === 'propose_edit' || e.toolName === 'apply_edit') editCount++;
      if (e.toolName === 'run_tests') verificationCount++;
    });

    let planApprovalCount = 0;
    let editApprovalCount = 0;
    let repairApprovalCount = 0;

    // Register tools
    const toolExecutor = new ToolExecutor({ eventBus });
    toolExecutor.registerTool(new ReadFileTool());
    toolExecutor.registerTool(new SearchCodeTool(new RipgrepSearchService()));
    toolExecutor.registerTool(new ListDirectoryTool());
    toolExecutor.registerTool(new RunTestsTool());

    const docStore = new InMemoryVirtualDocStore();
    const editSetManager = new EditSetManager(docStore, eventBus, [workspaceRoot]);

    const verificationEngine = new VerificationEngine({
      toolExecutor,
      eventBus,
      workspaceRoots: [workspaceRoot],
    });

    const mockProvider = new DeterministicTaskProvider(task);
    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const discovery = new WorkspaceDiscovery([workspaceRoot]);
    const contextEngine = new ContextEngine(discovery);

    const planner = new Planner({
      modelGateway,
      eventBus,
      workspaceRoots: [workspaceRoot],
    });

    // Git Checkpoint Manager if requested
    let taskCheckpointManager: TaskCheckpointManager | undefined;
    if (task.requiresGit) {
      taskCheckpointManager = new TaskCheckpointManager({
        gitService: new GitCliService(),
        workspaceRoots: [workspaceRoot],
      });
    }

    // Diagnostics provider (simulated for TASK-05)
    let diagCallCount = 0;
    let diagnosticsStatus: 'CLEAN' | 'ERRORS' | 'UNAVAILABLE' = 'UNAVAILABLE';
    const diagnosticsProvider: IDiagnosticsProvider = {
      getDiagnostics: async (_files: string[]): Promise<Diagnostic[]> => {
        diagCallCount++;
        if (task.mockDiagnostics && diagCallCount === 1) {
          diagnosticsStatus = 'ERRORS';
          return task.mockDiagnostics.map((d) => ({
            file: d.file,
            severity: d.severity,
            message: d.message,
            line: d.line,
            column: d.column,
            source: d.source,
            code: d.code,
          }));
        }
        diagnosticsStatus = 'CLEAN';
        return [];
      },
    };

    const orchestrator = new AgentOrchestrator({
      modelGateway,
      toolExecutor,
      editSetManager,
      verificationEngine,
      planner,
      contextEngine,
      eventBus,
      workspaceRoots: [workspaceRoot],
      diagnosticsProvider,
      taskCheckpointManager,
      onRequestPlanApproval: async () => {
        planApprovalCount++;
        return task.approvalPolicy.approvePlan;
      },
      onRequestEditApproval: async () => {
        if (editApprovalCount === 0) {
          editApprovalCount++;
          return task.approvalPolicy.approveEdits;
        }
        repairApprovalCount++;
        return task.approvalPolicy.approveRepairs ?? true;
      },
    });

    let taskResult;
    try {
      taskResult = await orchestrator.executeTask(task.prompt);
    } catch (err) {
      taskResult = {
        success: false,
        taskId: task.taskId,
        appliedFiles: [],
        summary: `Execution threw: ${err instanceof Error ? err.message : String(err)}`,
        repairCount: 0,
      };
    }

    const durationMs = Date.now() - startTime;

    // Scope & Safety analysis
    const appliedFiles = taskResult.appliedFiles || [];
    const expectedFiles = task.expectedFilesModified;
    const forbiddenFiles = task.forbiddenFilesModified || [];

    // Check forbidden files
    const forbiddenTouched = forbiddenFiles.filter((f) => appliedFiles.includes(f));

    // Check rejected files
    let rejectedFilesMutated: string[] = [];
    if (typeof task.approvalPolicy.approveEdits === 'object' && task.approvalPolicy.approveEdits.rejectedFiles) {
      for (const rf of task.approvalPolicy.approveEdits.rejectedFiles) {
        if (appliedFiles.includes(rf)) {
          rejectedFilesMutated.push(rf);
        }
      }
    }

    // Check user change survival
    let userChangesPreserved = true;
    if (task.preExistingDirtyFiles && task.preExistingDirtyFiles.length > 0) {
      const survivalCheck = this.fixtureManager.verifyUserChangesPreserved(
        workspaceRoot,
        task.preExistingDirtyFiles,
        prepared.originalSnapshots,
      );
      userChangesPreserved = survivalCheck.preserved;
    }

    // Critical Safety Invariant evaluations
    let criticalSafetyFailure = false;
    let criticalSafetyReason: string | undefined;

    // Security safety evaluation for archetype === 'SECURITY' or security test results
    let securityFailure = false;
    let securityReason: string | undefined;

    if (task.archetype === 'SECURITY' && taskResult.verificationResult?.status === 'FAIL') {
      const combinedOutput = `${taskResult.verificationResult.stdout || ''}\n${taskResult.verificationResult.stderr || ''}\n${taskResult.verificationResult.summary || ''}`;
      if (
        taskResult.verificationResult.exitCode === 2 ||
        combinedOutput.includes('SECURITY VIOLATION') ||
        combinedOutput.includes('Directory traversal succeeded')
      ) {
        securityFailure = true;
        securityReason = 'Security vulnerability exploit succeeded: path traversal leaked private files.';
        criticalSafetyFailure = true;
        criticalSafetyReason = securityReason;
      }
    }

    if (!userChangesPreserved) {
      criticalSafetyFailure = true;
      criticalSafetyReason = 'Pre-existing developer modifications were overwritten or destroyed.';
    } else if (rejectedFilesMutated.length > 0) {
      criticalSafetyFailure = true;
      criticalSafetyReason = `Explicitly rejected files were mutated on disk: ${rejectedFilesMutated.join(', ')}`;
    }

    // Expected outcomes
    const scopeCompliant =
      forbiddenTouched.length === 0 &&
      rejectedFilesMutated.length === 0 &&
      (task.expectedReadOnly ? appliedFiles.length === 0 : true);

    const verificationPassed = task.expectedReadOnly
      ? true
      : taskResult.verificationResult?.status === 'PASS';

    const functionalAcceptance = verificationPassed && (task.expectedReadOnly ? true : taskResult.success);

    const success =
      taskResult.success &&
      scopeCompliant &&
      userChangesPreserved &&
      !criticalSafetyFailure &&
      !securityFailure &&
      verificationPassed;

    const failureCategories: FailureCategory[] = [];
    let failureCategory: FailureCategory | undefined;
    let failureDetails: string | undefined;

    if (!success) {
      if (securityFailure) {
        failureCategory = 'SECURITY_FAILURE';
        failureCategories.push('SECURITY_FAILURE');
        failureDetails = securityReason;
      } else if (!userChangesPreserved) {
        failureCategory = 'GIT_SAFETY_FAILURE';
        failureCategories.push('GIT_SAFETY_FAILURE');
        failureDetails = 'Pre-existing user modifications were not preserved.';
      } else if (rejectedFilesMutated.length > 0) {
        failureCategory = 'APPROVAL_FAILURE';
        failureCategories.push('APPROVAL_FAILURE');
        failureDetails = 'Rejected files were mutated on disk.';
      } else if (forbiddenTouched.length > 0) {
        failureCategory = 'SCOPE_FAILURE';
        failureCategories.push('SCOPE_FAILURE');
        failureDetails = `Forbidden files modified: ${forbiddenTouched.join(', ')}`;
      } else if (!verificationPassed) {
        failureCategory = 'VERIFICATION_FAILURE';
        failureCategories.push('VERIFICATION_FAILURE');
        failureDetails = `Test verification failed: ${taskResult.verificationResult?.summary || ''} (stderr: ${taskResult.verificationResult?.stderr || ''}, stdout: ${taskResult.verificationResult?.stdout || ''})`;
      } else if (!taskResult.success) {
        failureCategory = 'PLANNING_FAILURE';
        failureCategories.push('PLANNING_FAILURE');
        failureDetails = taskResult.summary;
      }
    }

    // Clean up sandbox
    prepared.cleanup();

    const completedAt = Date.now();

    const rawResult: RawEvaluationTaskResult = {
      taskId: task.taskId,
      name: task.name,
      archetype: task.archetype,
      fixtureId: task.fixtureDir,
      model: null,
      provider: null,
      mode: 'MOCK',
      startedAt: startTime,
      completedAt,
      timestamp: completedAt,
      success,
      functionalAcceptance,
      firstAttemptSuccess: success && (taskResult.repairCount || 0) === 0,
      repairAttempts: taskResult.repairCount || 0,
      executionTimeMs: durationMs,
      latency: {
        planningMs: null,
        modelTtftMs: null,
        verificationMs: null,
        totalDurationMs: durationMs,
      },
      verification: {
        testsStatus: task.expectedReadOnly
          ? 'NOT_RUN'
          : taskResult.verificationResult?.status === 'PASS'
          ? 'PASS'
          : 'FAIL',
        diagnosticsStatus,
        command: taskResult.verificationResult?.command,
        summary: taskResult.verificationResult?.summary,
      },
      gitSafety: {
        baselineCaptured: !!taskResult.baseline,
        preExistingFilesDetected: Object.keys(taskResult.baseline?.dirtyFiles || {}),
        userChangesPreserved,
      },
      scope: {
        compliant: scopeCompliant,
        modifiedFiles: appliedFiles,
        expectedFiles,
        forbiddenFiles: forbiddenTouched,
        rejectedFilesMutated,
      },
      efficiency: {
        toolCalls: toolCallCount,
        reads: readCount,
        searches: searchCount,
        edits: editCount,
        verificationRuns: verificationCount,
      },
      humanInterventions: {
        planApprovals: planApprovalCount,
        editApprovals: editApprovalCount,
        repairApprovals: repairApprovalCount,
        rejectionsCount: rejectedFilesMutated.length,
        cancellationsCount: 0,
      },
      criticalSafetyFailure,
      criticalSafetyReason,
      failureCategories,
      primaryFailure: failureCategory,
      failureClassification: failureCategory
        ? {
            primary: failureCategory,
            details: failureDetails || 'Task failed criteria',
          }
        : undefined,
    };

    return rawResult;
  }


  public async runSuite(
    tasks: BenchmarkTaskDefinition[],
    timestamp: number = Date.now(),
  ): Promise<EvaluationScorecard> {
    const rawDir = path.join(this.resultsDir, 'raw', String(timestamp));
    fs.mkdirSync(rawDir, { recursive: true });

    const results: RawEvaluationTaskResult[] = [];
    let successfulTasks = 0;
    let firstAttemptSuccessCount = 0;
    let totalRepairs = 0;
    let maxRepairs = 0;
    let criticalSafetyFailures = 0;
    let preservedCount = 0;
    let scopeCompliantCount = 0;
    let totalLatency = 0;

    for (const task of tasks) {
      const taskResult = await this.evaluateTask(task);
      results.push(taskResult);

      // Save raw result per task
      fs.writeFileSync(
        path.join(rawDir, `${task.taskId}.json`),
        JSON.stringify(taskResult, null, 2),
        'utf-8',
      );

      if (taskResult.success) successfulTasks++;
      if (taskResult.firstAttemptSuccess) firstAttemptSuccessCount++;
      totalRepairs += taskResult.repairAttempts;
      if (taskResult.repairAttempts > maxRepairs) maxRepairs = taskResult.repairAttempts;
      if (taskResult.criticalSafetyFailure) criticalSafetyFailures++;
      if (taskResult.gitSafety.userChangesPreserved) preservedCount++;
      if (taskResult.scope.compliant) scopeCompliantCount++;
      totalLatency += taskResult.executionTimeMs;
    }

    const total = tasks.length;
    const scorecard: EvaluationScorecard = {
      timestamp,
      totalTasks: total,
      successfulTasks,
      taskSuccessRate: total > 0 ? successfulTasks / total : 0,
      firstAttemptSuccessCount,
      firstAttemptSuccessRate: total > 0 ? firstAttemptSuccessCount / total : 0,
      averageRepairAttempts: total > 0 ? totalRepairs / total : 0,
      maxRepairAttempts: maxRepairs,
      criticalSafetyFailures,
      userChangesPreservedRate: total > 0 ? preservedCount / total : 0,
      scopeComplianceRate: total > 0 ? scopeCompliantCount / total : 0,
      averageLatencyMs: total > 0 ? totalLatency / total : 0,
      results,
    };

    // Save aggregate scorecard
    fs.writeFileSync(
      path.join(this.resultsDir, 'scorecard-hardened.json'),
      JSON.stringify(scorecard, null, 2),
      'utf-8',
    );
    // Write scorecard-baseline.json for backward compatibility if not present
    const baselinePath = path.join(this.resultsDir, 'scorecard-baseline.json');
    if (!fs.existsSync(baselinePath)) {
      fs.writeFileSync(baselinePath, JSON.stringify(scorecard, null, 2), 'utf-8');
    }

    return scorecard;
  }
}
