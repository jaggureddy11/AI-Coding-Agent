import { AgentState } from './state.js';
import { PermissionTier } from './tools.js';

export interface PlanStep {
  stepIndex: number;
  description: string;
  targetFiles: string[];
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
}

export interface Plan {
  id: string;
  taskId: string;
  title: string;
  steps: PlanStep[];
  approved: boolean;
}

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
