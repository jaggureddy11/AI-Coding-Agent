import { ModelGateway } from '../models/gateway.js';
import { ModelMessage } from '../types/models.js';
import { ContextPackage } from '../context/types.js';
import { EventBus } from '../events/eventBus.js';
import { Plan, PlanSchema } from '../types/plan.js';
import { PlanValidator } from './planValidator.js';

export interface PlannerOptions {
  modelGateway: ModelGateway;
  eventBus: EventBus;
  workspaceRoots: string[];
  providerId?: string;
  model?: string;
  maxPlanAttempts?: number;
}

export class Planner {
  private readonly modelGateway: ModelGateway;
  private readonly eventBus: EventBus;
  private readonly workspaceRoots: string[];
  private readonly providerId: string;
  private readonly model?: string;
  private readonly maxPlanAttempts: number;

  constructor(options: PlannerOptions) {
    this.modelGateway = options.modelGateway;
    this.eventBus = options.eventBus;
    this.workspaceRoots = options.workspaceRoots;
    this.providerId = options.providerId ?? 'mock';
    this.model = options.model;
    this.maxPlanAttempts = options.maxPlanAttempts ?? 2;
  }

  /**
   * Generates and validates a structured Plan for a user request grounded in repository context.
   */
  public async createPlan(
    userPrompt: string,
    contextPackage: ContextPackage,
    abortSignal?: AbortSignal,
  ): Promise<{ success: boolean; plan?: Plan; errors?: string[] }> {
    const systemPrompt = `You are JAGGU's senior software planning engine.
Your task is to analyze the user request and repository context, then formulate a precise, structured, multi-step engineering plan.

CRITICAL REQUIREMENTS:
1. Ground your plan strictly in the provided workspace files. Do NOT invent phantom files.
2. If creating a new file, explicitly declare it in the step's "newFiles" array.
3. Every step must have a unique "id" (e.g. "step-1", "step-2"), a clear "description", "expectedOutcome", and "verification" criteria.
4. "dependencies" must list prerequisite step IDs, forming a valid acyclic dependency graph.
5. "risks" and "verification" arrays must be populated with realistic technical considerations.
6. Output MUST be ONLY valid JSON matching this schema (do not wrap in markdown or conversational chatter):

{
  "id": "plan-1",
  "goal": "Description of overall goal",
  "assumptions": ["assumption 1"],
  "steps": [
    {
      "id": "step-1",
      "description": "Inspect authentication middleware",
      "files": ["src/middleware/auth.ts"],
      "newFiles": [],
      "dependencies": [],
      "expectedOutcome": "Identify rate-limiting injection point",
      "verification": "Targeted test run",
      "status": "PENDING"
    }
  ],
  "risks": ["Potential test timing variations"],
  "verification": ["npm test"]
}`;

    const contextSummary = contextPackage.promptContextText ||
      (contextPackage.snippets && contextPackage.snippets.length > 0
        ? contextPackage.snippets.map((s) => `--- File: ${s.relativeFilePath} (lines ${s.startLine}-${s.endLine}) ---\n${s.content}\n--- End File ---`).join('\n\n')
        : 'No specific workspace snippets found.');

    const messages: ModelMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Repository Context:\n${contextSummary}\n\nUser Request: ${userPrompt}\n\nGenerate the structured JSON plan:` },
    ];

    let attempts = 0;
    let lastErrors: string[] = [];

    while (attempts < this.maxPlanAttempts) {
      if (abortSignal?.aborted) {
        return { success: false, errors: ['Planning operation cancelled by user.'] };
      }

      attempts++;

      let content = '';
      const stream = this.modelGateway.streamChat(
        this.providerId,
        messages,
        {
          model: this.model || this.modelGateway.getProvider(this.providerId).defaultModel,
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

      const planCandidate = this.extractJson(content);
      if (!planCandidate) {
        lastErrors = ['Model did not return a valid JSON plan object.'];
        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: `Your previous response could not be parsed as JSON. Please return ONLY raw JSON matching the required schema. Errors:\n${lastErrors.join('\n')}`,
        });
        continue;
      }

      // Validate candidate plan
      const validation = PlanValidator.validate(planCandidate, this.workspaceRoots);
      if (validation.valid) {
        const parsed = PlanSchema.parse(planCandidate);
        this.eventBus.emit('plan.created', {
          planId: parsed.id,
          goal: parsed.goal,
          stepCount: parsed.steps.length,
          timestamp: Date.now(),
        });
        this.eventBus.emit('plan.validated', {
          planId: parsed.id,
          valid: true,
          timestamp: Date.now(),
        });
        return { success: true, plan: parsed };
      }

      lastErrors = validation.errors;
      messages.push({ role: 'assistant', content });
      messages.push({
        role: 'user',
        content: `The plan failed validation against the workspace. Please correct the plan and return updated JSON. Validation errors:\n${validation.errors.join('\n')}`,
      });
    }

    return {
      success: false,
      errors: [`Failed to produce a valid plan after ${this.maxPlanAttempts} attempts: ${lastErrors.join('; ')}`],
    };
  }

  private extractJson(text?: string): unknown {
    if (!text) return null;
    const trimmed = text.trim();
    // Direct parse attempt
    try {
      return JSON.parse(trimmed);
    } catch {
      // Look for ```json ... ``` block
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          // fallback
        }
      }
      // Look for outermost { ... }
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}
