import * as fs from 'fs';
import { Plan, PlanSchema, PlanValidationResult } from '../types/plan.js';
import { resolveAndValidateWorkspacePath } from '../tools/security.js';

export class PlanValidator {
  /**
   * Validates a candidate Plan against the schema, workspace boundaries, file existence, and DAG acyclicity.
   */
  public static validate(plan: unknown, workspaceRoots: string[]): PlanValidationResult {
    const errors: string[] = [];

    // 1. Zod Schema Validation
    const parsed = PlanSchema.safeParse(plan);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`[Schema] ${issue.path.join('.')}: ${issue.message}`);
      }
      return { valid: false, errors };
    }

    const validPlan: Plan = parsed.data;

    // 2. Step ID uniqueness and dependency validation (DAG)
    const stepIds = new Set<string>();
    for (const step of validPlan.steps) {
      if (stepIds.has(step.id)) {
        errors.push(`[Structure] Duplicate step ID found: "${step.id}"`);
      }
      stepIds.add(step.id);
    }

    const adj = new Map<string, string[]>();
    for (const step of validPlan.steps) {
      adj.set(step.id, step.dependencies);
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          errors.push(`[Dependency] Step "${step.id}" references non-existent dependency "${dep}"`);
        }
        if (dep === step.id) {
          errors.push(`[Dependency] Step "${step.id}" cannot depend on itself`);
        }
      }
    }

    // Check for circular dependencies
    if (this.hasCycle(adj)) {
      errors.push('[Dependency] Plan contains a circular dependency between steps');
    }

    // 3. Workspace containment and file existence validation
    for (const step of validPlan.steps) {
      const declaredNew = new Set(step.newFiles || []);

      for (const file of step.files) {
        try {
          const resolvedPath = resolveAndValidateWorkspacePath(file, workspaceRoots);

          // Dangerous path patterns
          const normalized = file.replace(/\\/g, '/');
          if (normalized.includes('.git/') || normalized.includes('node_modules/')) {
            errors.push(`[Security] Step "${step.id}" targets protected system/vendor path: "${file}"`);
          }

          // Existence check
          if (!declaredNew.has(file)) {
            if (!fs.existsSync(resolvedPath)) {
              errors.push(
                `[Workspace] Step "${step.id}" references file "${file}" which does not exist on disk and is not declared in newFiles.`,
              );
            }
          }
        } catch (err) {
          errors.push(
            `[Security] Step "${step.id}" references invalid/out-of-workspace path: "${file}" (${err instanceof Error ? err.message : String(err)})`,
          );
        }
      }

      for (const newFile of step.newFiles) {
        try {
          resolveAndValidateWorkspacePath(newFile, workspaceRoots);
        } catch (err) {
          errors.push(
            `[Security] Step "${step.id}" declares invalid/out-of-workspace newFile: "${newFile}" (${err instanceof Error ? err.message : String(err)})`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static hasCycle(adj: Map<string, string[]>): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }
}
