import { AgentState } from './state.js';
import { PermissionTier } from './tools.js';
import { Plan, PlanStep } from './plan.js';

export type { Plan, PlanStep };

export interface Task {
  id: string;
  conversationId: string;
  prompt: string;
  state: AgentState;
  plan?: Plan;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  operationType: 'PLAN' | 'FILE_WRITE' | 'COMMAND';
  description: string;
  permissionTier: PermissionTier;
  payload: Record<string, unknown>;
  requestedAt: number;
}
