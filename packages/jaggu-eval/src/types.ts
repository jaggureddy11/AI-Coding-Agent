export type BenchmarkArchetype =
  | 'FEATURE'
  | 'DEBUG'
  | 'REFACTOR'
  | 'TESTGEN'
  | 'CODE_INTEL'
  | 'GIT_SAFETY'
  | 'PARTIAL_APPROVAL'
  | 'EXPLAIN';

export type BenchmarkDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type FailureCategory =
  | 'CONTEXT_FAILURE'
  | 'PLANNING_FAILURE'
  | 'TOOL_FAILURE'
  | 'EDIT_FAILURE'
  | 'APPROVAL_FAILURE'
  | 'GIT_SAFETY_FAILURE'
  | 'DIAGNOSTIC_FAILURE'
  | 'VERIFICATION_FAILURE'
  | 'REPAIR_FAILURE'
  | 'SCOPE_FAILURE'
  | 'ENVIRONMENT_LIMITATION'
  | 'UNSUPPORTED_CAPABILITY';

export interface TaskApprovalPolicy {
  approvePlan: boolean;
  approveEdits: boolean | { approved: boolean; approvedFiles?: string[]; rejectedFiles?: string[] };
  approveRepairs?: boolean | { approved: boolean; approvedFiles?: string[]; rejectedFiles?: string[] };
}

export interface BenchmarkTaskDefinition {
  readonly taskId: string;
  readonly name: string;
  readonly archetype: BenchmarkArchetype;
  readonly difficulty: BenchmarkDifficulty;
  readonly fixtureDir: string;
  readonly prompt: string;
  readonly expectedFilesModified: string[];
  readonly forbiddenFilesModified?: string[];
  readonly expectedReadOnly?: boolean;
  readonly timeoutSeconds: number;
  readonly requiresGit?: boolean;
  readonly preExistingDirtyFiles?: string[];
  readonly approvalPolicy: TaskApprovalPolicy;
  readonly verificationCommand?: string;
  readonly mockResponses: {
    plan: {
      id?: string;
      goal: string;
      assumptions?: string[];
      steps: Array<{
        id?: string;
        description: string;
        files?: string[];
        newFiles?: string[];
        dependencies?: string[];
        expectedOutcome?: string;
        verification?: string;
      }>;
      risks?: string[];
      verification?: string | string[];
    };
    edits: Array<{
      relativePath: string;
      proposedContent: string;
      isNewFile: boolean;
    }>;
    diagnosticRepairs?: Array<{
      relativePath: string;
      proposedContent: string;
      isNewFile: boolean;
    }>;
    testRepairs?: Array<{
      relativePath: string;
      proposedContent: string;
      isNewFile: boolean;
    }>;
  };
  readonly mockDiagnostics?: Array<{
    file: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }>;
}

export interface RawEvaluationTaskResult {
  readonly taskId: string;
  readonly name: string;
  readonly archetype: BenchmarkArchetype;
  readonly timestamp: number;
  readonly success: boolean;
  readonly firstAttemptSuccess: boolean;
  readonly repairAttempts: number;
  readonly executionTimeMs: number;
  readonly verification: {
    testsStatus: 'PASS' | 'FAIL' | 'NOT_RUN';
    diagnosticsStatus: 'CLEAN' | 'ERRORS' | 'UNAVAILABLE';
    command?: string;
    summary?: string;
  };
  readonly gitSafety: {
    baselineCaptured: boolean;
    preExistingFilesDetected: string[];
    userChangesPreserved: boolean;
  };
  readonly scope: {
    compliant: boolean;
    modifiedFiles: string[];
    expectedFiles: string[];
    forbiddenFiles: string[];
    rejectedFilesMutated: string[];
  };
  readonly efficiency: {
    toolCalls: number;
    reads: number;
    searches: number;
    edits: number;
    verificationRuns: number;
  };
  readonly humanInterventions: {
    planApprovals: number;
    editApprovals: number;
    repairApprovals: number;
  };
  readonly criticalSafetyFailure: boolean;
  readonly criticalSafetyReason?: string;
  readonly failureClassification?: {
    primary: FailureCategory;
    secondary?: FailureCategory;
    details: string;
  };
}

export interface EvaluationScorecard {
  readonly timestamp: number;
  readonly totalTasks: number;
  readonly successfulTasks: number;
  readonly taskSuccessRate: number;
  readonly firstAttemptSuccessCount: number;
  readonly firstAttemptSuccessRate: number;
  readonly averageRepairAttempts: number;
  readonly maxRepairAttempts: number;
  readonly criticalSafetyFailures: number;
  readonly userChangesPreservedRate: number;
  readonly scopeComplianceRate: number;
  readonly averageLatencyMs: number;
  readonly results: RawEvaluationTaskResult[];
}

// Legacy types for BenchmarkRunner backwards compatibility
export interface BenchmarkResult {
  readonly taskId: string;
  readonly passed: boolean;
  readonly executionTimeMs: number;
  readonly tokensConsumed: number;
  readonly toolCallsCount: number;
  readonly error?: string;
}

export interface BenchmarkScorecard {
  readonly timestamp: number;
  readonly totalTasks: number;
  readonly successfulTasks: number;
  readonly taskSuccessRate: number;
  readonly averageLatencyMs: number;
  readonly totalTokens: number;
  readonly results: BenchmarkResult[];
}

export type BenchmarkTask = BenchmarkTaskDefinition;
