import { AgentState } from './state.js';

export interface JagguEvents {
  'agent.started': {
    taskId: string;
    conversationId: string;
    prompt: string;
    timestamp: number;
  };
  'agent.state_changed': {
    taskId: string;
    previousState: AgentState;
    currentState: AgentState;
    detail?: string;
    timestamp: number;
  };
  'agent.planning': {
    taskId: string;
    intent: string;
    timestamp: number;
  };
  'agent.waiting_for_approval': {
    taskId: string;
    approvalId: string;
    type: 'PLAN' | 'FILE_WRITE' | 'COMMAND';
    description: string;
    timestamp: number;
  };
  'agent.tool_started': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    timestamp: number;
  };
  'agent.tool_completed': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    success: boolean;
    durationMs: number;
    timestamp: number;
  };
  'agent.file_changed': {
    taskId: string;
    filePath: string;
    changeType: 'CREATE' | 'MODIFY' | 'DELETE';
    insertions: number;
    deletions: number;
    staged: boolean;
    timestamp: number;
  };
  'agent.command_started': {
    taskId: string;
    commandId: string;
    command: string;
    cwd: string;
    timestamp: number;
  };
  'agent.command_completed': {
    taskId: string;
    commandId: string;
    command: string;
    exitCode: number;
    durationMs: number;
    timestamp: number;
  };
  'agent.completed': {
    taskId: string;
    summary: string;
    totalFilesChanged: number;
    durationMs: number;
    tokensUsed: number;
    timestamp: number;
  };
  'agent.failed': {
    taskId: string;
    error: string;
    fatal: boolean;
    timestamp: number;
  };
  'agent.cancelled': {
    taskId: string;
    reason: string;
    timestamp: number;
  };

  // Model Gateway Lifecycle Events
  'model.requested': {
    taskId: string;
    provider: string;
    model: string;
    messageCount: number;
    timestamp: number;
  };
  'model.stream_started': {
    taskId: string;
    provider: string;
    model: string;
    timestamp: number;
  };
  'model.text_delta': {
    taskId: string;
    text: string;
    timestamp: number;
  };
  'model.tool_call_delta': {
    taskId: string;
    toolCallId: string;
    argumentsDelta: string;
    timestamp: number;
  };
  'model.completed': {
    taskId: string;
    provider: string;
    model: string;
    durationMs: number;
    promptTokens: number;
    completionTokens: number;
    timestamp: number;
  };
  'model.cancelled': {
    taskId: string;
    provider: string;
    model: string;
    timestamp: number;
  };
  'model.error': {
    taskId: string;
    provider: string;
    model: string;
    error: string;
    code: string;
    timestamp: number;
  };

  // Context Engine Lifecycle Events (M3)
  'context.search_started': {
    taskId: string;
    query: string;
    timestamp: number;
  };
  'context.search_completed': {
    taskId: string;
    matchesFound: number;
    timestamp: number;
  };
  'context.file_selected': {
    taskId: string;
    filePath: string;
    reason: string;
    score: number;
    timestamp: number;
  };
  'context.assembled': {
    taskId: string;
    filesCount: number;
    totalTokens: number;
    truncated: boolean;
    timestamp: number;
  };
  'context.error': {
    taskId: string;
    error: string;
    timestamp: number;
  };

  // Tool Lifecycle Events (M4)
  'tool.requested': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    timestamp: number;
  };
  'tool.validation_failed': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    error: string;
    timestamp: number;
  };
  'tool.permission_required': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    permissionTier: string;
    description: string;
    timestamp: number;
  };
  'tool.started': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    timestamp: number;
  };
  'tool.progress': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    message: string;
    timestamp: number;
  };
  'tool.completed': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    success: boolean;
    durationMs: number;
    timestamp: number;
  };
  'tool.failed': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    error: string;
    timestamp: number;
  };
  'tool.cancelled': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    timestamp: number;
  };

  // Edit Lifecycle Events (M4)
  'edit.proposed': {
    taskId: string;
    proposalId: string;
    filePath: string;
    diffSummary: string;
    timestamp: number;
  };
  'edit.approved': {
    taskId: string;
    proposalId: string;
    filePath: string;
    timestamp: number;
  };
  'edit.rejected': {
    taskId: string;
    proposalId: string;
    filePath: string;
    reason?: string;
    timestamp: number;
  };
  'edit.applied': {
    taskId: string;
    proposalId: string;
    filePath: string;
    linesChanged: number;
    timestamp: number;
  };
  'edit.conflict': {
    taskId: string;
    proposalId: string;
    filePath: string;
    reason: string;
    timestamp: number;
  };
}

export type EventKey = keyof JagguEvents;
export type EventHandler<K extends EventKey> = (payload: JagguEvents[K]) => void | Promise<void>;
