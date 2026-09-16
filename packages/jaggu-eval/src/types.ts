import { z } from 'zod';

export type BenchmarkArchetype =
  | 'FEATURE'
  | 'DEBUG'
  | 'REFACTOR'
  | 'TESTGEN'
  | 'CODE_INTEL'
  | 'GIT_SAFETY'
  | 'PARTIAL_APPROVAL'
  | 'EXPLAIN'
  | 'SECURITY';

export type BenchmarkDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type EvaluationMode = 'MOCK' | 'LIVE';

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
  | 'MODEL_FAILURE'
  | 'PROVIDER_FAILURE'
  | 'SECURITY_FAILURE'
  | 'ENVIRONMENT_LIMITATION'
  | 'UNSUPPORTED_CAPABILITY';

export interface TaskApprovalPolicy {
  approvePlan: boolean;
  approveEdits: boolean | { approved: boolean; approvedFiles?: string[]; rejectedFiles?: string[] };
  approveRepairs?:
    boolean | { approved: boolean; approvedFiles?: string[]; rejectedFiles?: string[] };
}

export interface BenchmarkTaskDefinition {
  readonly taskId: string;
  readonly name: string;
  readonly archetype: BenchmarkArchetype;
  readonly difficulty: BenchmarkDifficulty;
  readonly fixtureDir: string;
  readonly prompt: string;
  readonly allowedFiles?: string[];
  readonly expectedFilesModified: string[];
  readonly forbiddenFilesModified?: string[];
  readonly expectedReadOnly?: boolean;
  readonly timeoutSeconds: number;
  readonly requiresGit?: boolean;
  readonly preExistingDirtyFiles?: string[];
  readonly approvalPolicy: TaskApprovalPolicy;
  readonly verificationCommand?: string;
  readonly expectedBehavior?: string;
  readonly verificationCriteria?: string[];
  readonly safetyRequirements?: string[];
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

export const BenchmarkTaskDefinitionSchema = z.object({
  taskId: z.string().regex(/^TASK-\d{2}$/),
  name: z.string().min(3),
  archetype: z.enum([
    'FEATURE',
    'DEBUG',
    'REFACTOR',
    'TESTGEN',
    'CODE_INTEL',
    'GIT_SAFETY',
    'PARTIAL_APPROVAL',
    'EXPLAIN',
    'SECURITY',
  ]),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  fixtureDir: z.string().min(1),
  prompt: z.string().min(10),
  allowedFiles: z.array(z.string()).optional(),
  expectedFilesModified: z.array(z.string()),
  forbiddenFilesModified: z.array(z.string()).optional(),
  expectedReadOnly: z.boolean().optional(),
  timeoutSeconds: z.number().positive(),
  requiresGit: z.boolean().optional(),
  preExistingDirtyFiles: z.array(z.string()).optional(),
  approvalPolicy: z.object({
    approvePlan: z.boolean(),
    approveEdits: z.union([
      z.boolean(),
      z.object({
        approved: z.boolean(),
        approvedFiles: z.array(z.string()).optional(),
        rejectedFiles: z.array(z.string()).optional(),
      }),
    ]),
    approveRepairs: z
      .union([
        z.boolean(),
        z.object({
          approved: z.boolean(),
          approvedFiles: z.array(z.string()).optional(),
          rejectedFiles: z.array(z.string()).optional(),
        }),
      ])
      .optional(),
  }),
  verificationCommand: z.string().optional(),
  expectedBehavior: z.string().optional(),
  verificationCriteria: z.array(z.string()).optional(),
  safetyRequirements: z.array(z.string()).optional(),
  mockResponses: z.object({
    plan: z.object({
      id: z.string().optional(),
      goal: z.string().min(5),
      assumptions: z.array(z.string()).optional(),
      steps: z
        .array(
          z.object({
            id: z.string().optional(),
            description: z.string().min(3),
            files: z.array(z.string()).optional(),
            newFiles: z.array(z.string()).optional(),
            dependencies: z.array(z.string()).optional(),
            expectedOutcome: z.string().optional(),
            verification: z.string().optional(),
          }),
        )
        .min(1),
      risks: z.array(z.string()).optional(),
      verification: z.union([z.string(), z.array(z.string())]).optional(),
    }),
    edits: z.array(
      z.object({
        relativePath: z.string().min(1),
        proposedContent: z.string(),
        isNewFile: z.boolean(),
      }),
    ),
    diagnosticRepairs: z
      .array(
        z.object({
          relativePath: z.string().min(1),
          proposedContent: z.string(),
          isNewFile: z.boolean(),
        }),
      )
      .optional(),
    testRepairs: z
      .array(
        z.object({
          relativePath: z.string().min(1),
          proposedContent: z.string(),
          isNewFile: z.boolean(),
        }),
      )
      .optional(),
  }),
});

export interface RawEvaluationTaskResult {
  readonly taskId: string;
  readonly name: string;
  readonly archetype: BenchmarkArchetype;
  readonly fixtureId: string;
  readonly model: string | null;
  readonly provider: string | null;
  readonly mode: EvaluationMode;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly timestamp: number;
  readonly success: boolean;
  readonly functionalAcceptance: boolean;
  readonly firstAttemptSuccess: boolean;
  readonly repairAttempts: number;
  readonly executionTimeMs: number;
  readonly latency: {
    planningMs: number | null;
    modelTtftMs: number | null;
    verificationMs: number | null;
    totalDurationMs: number;
  };
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
    rejectionsCount: number;
    cancellationsCount: number;
  };
  readonly criticalSafetyFailure: boolean;
  readonly criticalSafetyReason?: string;
  readonly failureCategories: FailureCategory[];
  readonly primaryFailure?: FailureCategory;
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
