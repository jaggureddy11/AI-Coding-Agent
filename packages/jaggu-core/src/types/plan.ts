import { z } from 'zod';

export type PlanStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export const PlanStepSchema = z.object({
  id: z.string().min(1, 'Step ID is required'),
  description: z.string().min(3, 'Meaningful step description is required'),
  files: z.array(z.string()).default([]),
  newFiles: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  expectedOutcome: z.string().min(1, 'Expected outcome is required'),
  verification: z.string().min(1, 'Verification method is required'),
  status: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const upper = val.toUpperCase();
        if (['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED'].includes(upper)) {
          return upper;
        }
      }
      return 'PENDING';
    }, z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED']))
    .default('PENDING'),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

export const PlanSchema = z.object({
  id: z.string().min(1, 'Plan ID is required'),
  goal: z.string().min(3, 'Goal description is required'),
  assumptions: z.array(z.string()).default([]),
  steps: z.array(PlanStepSchema).min(1, 'Plan must contain at least one step'),
  risks: z.array(z.string()).default([]),
  verification: z.array(z.string()).min(1, 'Plan must define at least one verification strategy'),
});

export type Plan = z.infer<typeof PlanSchema>;

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
}
