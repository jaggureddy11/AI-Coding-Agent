import React, { useState, useEffect, useRef } from 'react';
import type { UiAgentStatus, ContextSnippetSummary, ModelDescriptor } from '@jaggu/core';
import { StatusPill } from './components/StatusPill.js';
import { ContextPill } from './components/ContextPill.js';
import { ApprovalCard, ApprovalFileItem } from './components/ApprovalCard.js';
import { PlanCard, PlanStepItem } from './components/PlanCard.js';
import { ModelSelector } from './components/ModelSelector.js';
import { VoiceTypingButton } from './components/VoiceTypingButton.js';
import { TrustBadgeBar } from './components/TrustBadgeBar.js';
import { MarkdownMessage } from './components/MarkdownMessage.js';
import { FileMentionDropdown } from './components/FileMentionDropdown.js';
import { AttachedFilesBar } from './components/AttachedFilesBar.js';
import { ExecutionDrawer, LogEntry } from './components/ExecutionDrawer.js';
import {
  VsCodeApi,
  ChatMessage,
  ExtensionToWebviewMessage,
  isValidExtensionMessage,
} from './types/rpc.js';

export interface AppProps {
  vscode?: VsCodeApi;
  initialStatus?: UiAgentStatus;
  initialMessages?: ChatMessage[];
}

export interface ProposalItem {
  proposalId: string;
  filePath?: string;
  files?: ApprovalFileItem[];
  diffSummary?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ActivePlanState {
  taskId: string;
  planId: string;
  goal: string;
  steps: PlanStepItem[];
  risks: string[];
  verification: string[];
}

export interface ScopeChangeState {
  taskId: string;
  unplannedFiles: string[];
  reason: string;
}

export const App: React.FC<AppProps> = ({
  vscode,
  initialStatus = 'IDLE',
  initialMessages = [],
}) => {
  const [status, setStatus] = useState<UiAgentStatus>(initialStatus);
  const [statusDetail, setStatusDetail] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [activePlan, setActivePlan] = useState<ActivePlanState | null>(null);
  const [scopeChange, setScopeChange] = useState<ScopeChangeState | null>(null);
  const [input, setInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeConfig, setActiveConfig] = useState<{ provider: string; model: string }>({
    provider: 'mock',
    model: 'mock-fast',
  });
  const [availableModels, setAvailableModels] = useState<ModelDescriptor[]>([]);
  const [activeModelId, setActiveModelId] = useState<string>('auto');

  // Track 3: Workspace files, @file mentions, drag-drop attachments, and terminal logs
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([
    'packages/jaggu-core/src/agent/agentOrchestrator.ts',
    'packages/jaggu-core/src/models/gateway.ts',
    'packages/jaggu-server/src/index.ts',
    'packages/jaggu-ui/src/App.tsx',
    'packages/jaggu-vscode/src/extension.ts',
    'README.md',
    'package.json',
  ]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([
    {
      id: 'init_ready',
      type: 'info',
      line: 'JAGGU Agent Shell initialized. Ready for execution.',
      timestamp: Date.now(),
    },
  ]);

  const activeProvenanceRef = useRef<ContextSnippetSummary[] | undefined>();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  // Auto-resize prompt textarea dynamically as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const targetHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 44), 160);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [input]);

  // Listen for messages from the extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!isValidExtensionMessage(data)) {
        return;
      }

      const msg = data as ExtensionToWebviewMessage;
      switch (msg.type) {
        case 'agent.status':
          setStatus(msg.payload.state);
          setStatusDetail(msg.payload.detail);
          if (msg.payload.state === 'SUCCESS' || msg.payload.state === 'IDLE') {
            setErrorMessage(null);
          }
          break;
        case 'agent.message':
          setMessages((prev) => {
            // Avoid duplicate message if streamed
            if (prev.some((m) => m.id === msg.payload.id)) {
              return prev;
            }
            return [...prev, msg.payload];
          });
          break;
        case 'context.assembled':
          activeProvenanceRef.current = msg.payload.provenance;
          setStatusDetail(`Grounded in ${msg.payload.filesCount} workspace files`);
          break;
        case 'model.routed':
          setStatusDetail(`Auto selected: ${msg.payload.selectedModel} (${msg.payload.reason})`);
          break;
        case 'model.fallback':
          setStatusDetail(
            `Fallback from ${msg.payload.fromModel} to ${msg.payload.toModel}: ${msg.payload.reason}`,
          );
          break;
        case 'token.delta': {
          const { messageId, text } = msg.payload;
          setMessages((prev) => {
            const index = prev.findIndex((m) => m.id === messageId);
            if (index >= 0) {
              const updated = [...prev];
              const existing = updated[index];
              if (existing) {
                updated[index] = { ...existing, text: existing.text + text };
              }
              return updated;
            } else {
              return [
                ...prev,
                {
                  id: messageId,
                  role: 'assistant',
                  text,
                  timestamp: Date.now(),
                  provenance: activeProvenanceRef.current,
                },
              ];
            }
          });
          break;
        }
        case 'token.complete': {
          const { messageId, fullText, provenance } = msg.payload;
          setMessages((prev) => {
            const index = prev.findIndex((m) => m.id === messageId);
            if (index >= 0) {
              const updated = [...prev];
              const existing = updated[index];
              if (existing) {
                updated[index] = {
                  ...existing,
                  text: fullText,
                  provenance: provenance || existing.provenance || activeProvenanceRef.current,
                };
              }
              return updated;
            } else {
              return [
                ...prev,
                {
                  id: messageId,
                  role: 'assistant',
                  text: fullText,
                  timestamp: Date.now(),
                  provenance: provenance || activeProvenanceRef.current,
                },
              ];
            }
          });
          break;
        }
        case 'agent.approval_requested': {
          const { proposalId, filePath, diffSummary } = msg.payload;
          setProposals((prev) => {
            const filtered = prev.filter((p) => p.proposalId !== proposalId);
            return [...filtered, { proposalId, filePath, diffSummary, status: 'pending' }];
          });
          break;
        }
        case 'agent.plan_requested': {
          const { taskId, planId, goal, steps, risks, verification } = msg.payload;
          setActivePlan({ taskId, planId, goal, steps, risks, verification });
          setStatus('PLAN_REVIEW' as any);
          setStatusDetail('Engineering plan generated — review required');
          break;
        }
        case 'agent.editset_requested': {
          const { editSetId, files } = msg.payload;
          setProposals((prev) => {
            const filtered = prev.filter((p) => p.proposalId !== editSetId);
            return [
              ...filtered,
              {
                proposalId: editSetId,
                files,
                diffSummary: `Multi-file change set proposing ${files.length} file updates`,
                status: 'pending',
              },
            ];
          });
          setStatus('EDIT_REVIEW' as any);
          setStatusDetail(`Change set ready: ${files.length} files awaiting review`);
          break;
        }
        case 'agent.scope_change_requested': {
          const { taskId, unplannedFiles, reason } = msg.payload;
          setScopeChange({ taskId, unplannedFiles, reason });
          setStatusDetail(`Scope change requested: ${unplannedFiles.length} unplanned files`);
          break;
        }
        case 'agent.activity':
          setStatusDetail(msg.payload.message);
          break;
        case 'agent.config':
          setActiveConfig({ provider: msg.payload.provider, model: msg.payload.model });
          if (msg.payload.model && msg.payload.model !== 'auto') {
            setActiveModelId((prev) => (prev === 'auto' ? 'auto' : msg.payload.model));
          }
          if (Array.isArray(msg.payload.models) && msg.payload.models.length > 0) {
            setAvailableModels(msg.payload.models);
          }
          break;
        case 'model.health_changed': {
          const { modelId, health, detail } = msg.payload;
          setAvailableModels((prev) =>
            prev.map((m) => (m.id === modelId ? { ...m, health, healthDetail: detail } : m)),
          );
          break;
        }
        case 'workspace.files': {
          if (Array.isArray(msg.payload.files) && msg.payload.files.length > 0) {
            setWorkspaceFiles(msg.payload.files);
          }
          break;
        }
        case 'terminal.log': {
          setTerminalLogs((prev) => [
            ...prev,
            {
              id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: msg.payload.type,
              line: msg.payload.line,
              timestamp: msg.payload.timestamp,
            },
          ]);
          break;
        }
        case 'agent.error':
          setErrorMessage(msg.payload.message);
          setStatus('ERROR');
          setTerminalLogs((prev) => [
            ...prev,
            {
              id: `err_${Date.now()}`,
              type: 'stderr',
              line: msg.payload.message,
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'TASK_ERROR':
          setErrorMessage(msg.payload.error);
          setStatus('ERROR');
          setTerminalLogs((prev) => [
            ...prev,
            {
              id: `err_${Date.now()}`,
              type: 'stderr',
              line: msg.payload.error,
              timestamp: Date.now(),
            },
          ]);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Notify extension that webview is ready & request workspace files
    vscode?.postMessage({
      type: 'ui.ready',
      payload: { timestamp: Date.now() },
    });
    vscode?.postMessage({
      type: 'workspace.request_files',
    });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [vscode]);

  const handleModelSelect = (newModelId: string) => {
    setActiveModelId(newModelId);
    vscode?.postMessage({
      type: 'model.select',
      payload: { modelId: newModelId },
    });
  };

  const handleRefreshHealth = () => {
    vscode?.postMessage({
      type: 'models.refresh_health',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    // Detect @ mention pattern
    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const query = textBeforeCursor.slice(lastAtPos + 1);
      // Valid mention query has no whitespace between '@' and cursor
      if (!/\s/.test(query)) {
        setMentionQuery(query);
        setMentionIndex(0);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (file: string) => {
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursor);
    const textAfterCursor = input.slice(cursor);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const newInput = textBeforeCursor.slice(0, lastAtPos) + `@${file} ` + textAfterCursor;
      setInput(newInput);
      setMentionQuery(null);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = lastAtPos + file.length + 2;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 10);
    }
  };

  const handleRemoveAttachedFile = (fileToRemove: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f !== fileToRemove));
  };

  const handleClearAttachedFiles = () => {
    setAttachedFiles([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const names: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f) names.push(f.name);
      }
      setAttachedFiles((prev) => Array.from(new Set([...prev, ...names])));
      setTerminalLogs((prev) => [
        ...prev,
        {
          id: `drop_${Date.now()}`,
          type: 'info',
          line: `Attached context file(s): ${names.join(', ')}`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || status === 'PROCESSING') return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setMentionQuery(null);
    setErrorMessage(null);

    // Send typed RPC to extension host with attached files
    const finalPrompt =
      attachedFiles.length > 0
        ? `${trimmed}\n\n[Attached Context: ${attachedFiles.map((f) => `@${f}`).join(', ')}]`
        : trimmed;

    setTerminalLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}`,
        type: 'info',
        line: `Prompt submitted: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '...' : ''}"`,
        timestamp: Date.now(),
      },
    ]);

    vscode?.postMessage({
      type: 'user.submit',
      payload: {
        id: userMsg.id,
        text: finalPrompt,
        timestamp: userMsg.timestamp,
        attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
      },
    });

    setAttachedFiles([]);
  };

  const handleCancel = () => {
    vscode?.postMessage({
      type: 'agent.cancel',
      payload: {},
    });
  };

  const handleClear = () => {
    setMessages([]);
    setProposals([]);
    setErrorMessage(null);
    setStatus('IDLE');
    setStatusDetail(undefined);
    setAttachedFiles([]);
    vscode?.postMessage({
      type: 'ui.clear',
      payload: {},
    });
  };

  const handleReviewDiff = (filePath: string) => {
    vscode?.postMessage({
      type: 'agent.review_diff',
      payload: { filePath },
    });
  };

  const handleApprovePlan = (planId: string) => {
    setActivePlan(null);
    vscode?.postMessage({
      type: 'agent.plan_approve',
      payload: { planId },
    });
  };

  const handleRejectPlan = (planId: string) => {
    setActivePlan(null);
    vscode?.postMessage({
      type: 'agent.plan_reject',
      payload: { planId },
    });
  };

  const handleApproveScope = () => {
    const taskId = scopeChange?.taskId;
    setScopeChange(null);
    vscode?.postMessage({
      type: 'agent.scope_approve',
      payload: { taskId },
    });
  };

  const handleRejectScope = () => {
    const taskId = scopeChange?.taskId;
    setScopeChange(null);
    vscode?.postMessage({
      type: 'agent.scope_reject',
      payload: { taskId },
    });
  };

  const handleApproveProposal = (proposalId: string, approvedFiles?: string[]) => {
    setProposals((prev) =>
      prev.map((p) => (p.proposalId === proposalId ? { ...p, status: 'approved' } : p)),
    );
    // Support both single proposalId and multi-file editSetId with selective approval
    vscode?.postMessage({
      type: 'agent.approve',
      payload: { proposalId },
    });
    vscode?.postMessage({
      type: 'agent.editset_approve',
      payload: { editSetId: proposalId, approvedFiles },
    });
  };

  const handleRejectProposal = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.proposalId === proposalId ? { ...p, status: 'rejected' } : p)),
    );
    vscode?.postMessage({
      type: 'agent.reject',
      payload: { proposalId },
    });
    vscode?.postMessage({
      type: 'agent.editset_reject',
      payload: { editSetId: proposalId },
    });
  };

  const handleVoiceTranscript = (text: string) => {
    setInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return text;
      }
      return `${trimmed} ${text}`;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null) {
      const filtered = workspaceFiles
        .filter((f) => f.toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 8);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % (filtered.length || 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && filtered.length > 0) {
        e.preventDefault();
        const selected = filtered[mentionIndex] || filtered[0];
        if (selected) {
          handleSelectMention(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      data-testid="jaggu-sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        boxSizing: 'border-box',
        backgroundColor: 'var(--vscode-sideBar-background, #18181b)',
        color: 'var(--vscode-sideBar-foreground, var(--vscode-foreground, #cccccc))',
        fontFamily:
          'var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
        fontSize: 'var(--vscode-font-size, 13px)',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header with branding, model selector & status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 14px',
          borderBottom:
            '1px solid var(--vscode-sideBarSectionHeader-border, rgba(255, 255, 255, 0.06))',
          backgroundColor: 'var(--vscode-sideBarSectionHeader-background, rgba(0, 0, 0, 0.1))',
          backdropFilter: 'blur(8px)',
          minHeight: '32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: '12.5px',
              letterSpacing: '-0.02em',
              color: 'var(--vscode-foreground, #ffffff)',
            }}
          >
            JAGGU
          </span>

          <span
            data-testid="provider-badge"
            style={{
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--vscode-descriptionForeground, #a1a1aa)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {activeConfig.provider}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <StatusPill state={status} />
          {messages.length > 0 && (
            <button
              data-testid="clear-btn"
              onClick={handleClear}
              title="Clear conversation"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--vscode-descriptionForeground, #858585)',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                opacity: 0.7,
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
              }}
            >
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Trust & Safe Execution Guarantee Bar (Visually hidden for minimal aesthetic) */}
      <TrustBadgeBar state={status} />

      {/* 2. Conversation Area */}
      <div
        data-testid="conversation-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative',
        }}
      >
        {/* Minimalist Drag-and-Drop Overlay */}
        {isDraggingOver && (
          <div
            data-testid="drag-drop-overlay"
            style={{
              position: 'absolute',
              inset: 8,
              backgroundColor: 'rgba(9, 9, 11, 0.85)',
              backdropFilter: 'blur(6px)',
              border: '2px dashed rgba(96, 165, 250, 0.7)',
              borderRadius: '10px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#93c5fd',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: '26px' }}>📄</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Drop files to attach as context</span>
            <span style={{ fontSize: '11px', opacity: 0.6 }}>Files will be grounded in prompt execution</span>
          </div>
        )}

        {messages.length === 0 ? (
          <div
            data-testid="empty-state"
            style={{
              margin: 'auto 0',
              textAlign: 'center',
              padding: '20px 8px',
              color: 'var(--vscode-descriptionForeground, #858585)',
            }}
          >
            {/* Minimalist Glowing Hero Icon */}
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                color: 'var(--vscode-foreground, #ffffff)',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="6" width="8.5" height="9.5" rx="3" />
                <rect x="13.5" y="6" width="8.5" height="9.5" rx="3" />
                <path d="M10.5 9.5a2 2 0 0 1 3 0" />
                <path d="M2 9.5H1" />
                <path d="M23 9.5h-1" />
                <path d="M7.5 9L5.5 10.75L7.5 12.5" />
                <path d="M16.5 9L18.5 10.75L16.5 12.5" />
              </svg>
            </div>

            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--vscode-foreground, #ffffff)',
                marginBottom: '16px',
                letterSpacing: '-0.01em',
              }}
            >
              What would you like me to build?
            </div>

            {/* Quick Prompt Cards - Minimal Blackbox/Antigravity style */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxWidth: '300px',
                margin: '0 auto',
              }}
            >
              {[
                { title: 'Explain this project' },
                { title: 'Plan a new feature' },
                { title: 'Diagnose compiler & test errors' },
                { title: 'Run tests & verify workspace' },
              ].map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    setInput(item.title);
                    textareaRef.current?.focus();
                  }}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    color: 'var(--vscode-foreground, #e4e4e7)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>⚡</span>
                  <span style={{ fontWeight: 400 }}>{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              data-testid={`message-${msg.role}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--vscode-descriptionForeground, #858585)',
                  marginBottom: '4px',
                  paddingLeft: msg.role === 'user' ? 0 : '4px',
                  paddingRight: msg.role === 'user' ? '4px' : 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {msg.role === 'user' ? (
                  <>
                    <span>You</span>
                    <span>•</span>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>JAGGU</span>
                    <span>•</span>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(msg.text)}
                      title="Copy response"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--vscode-descriptionForeground, #858585)',
                        cursor: 'pointer',
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        opacity: 0.7,
                        transition: 'opacity 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                    >
                      Copy
                    </button>
                  </>
                )}
              </div>
              <div
                style={{
                  maxWidth: '92%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  fontSize: '12px',
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                  backgroundColor:
                    msg.role === 'user'
                      ? 'var(--vscode-button-background, #0078d4)'
                      : 'rgba(255, 255, 255, 0.05)',
                  color:
                    msg.role === 'user'
                      ? 'var(--vscode-button-foreground, #ffffff)'
                      : 'var(--vscode-foreground, #e4e4e7)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow:
                    msg.role === 'user'
                      ? '0 2px 8px rgba(0, 120, 212, 0.3)'
                      : '0 2px 8px rgba(0, 0, 0, 0.15)',
                }}
              >
                {msg.role === 'assistant' ? (
                  <MarkdownMessage content={msg.text} />
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                )}
              </div>
              {msg.role === 'assistant' && msg.provenance && msg.provenance.length > 0 && (
                <div style={{ marginTop: '4px', paddingLeft: '2px' }}>
                  <ContextPill provenance={msg.provenance} />
                </div>
              )}
            </div>
          ))
        )}

        {/* Active Plan requiring user review */}
        {activePlan && (
          <div data-testid="plan-container">
            <PlanCard
              planId={activePlan.planId}
              goal={activePlan.goal}
              steps={activePlan.steps}
              risks={activePlan.risks}
              verification={activePlan.verification}
              onApprove={handleApprovePlan}
              onReject={handleRejectPlan}
            />
          </div>
        )}

        {/* Scope change notification requiring user review */}
        {scopeChange && (
          <div
            data-testid="scope-change-banner"
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'rgba(204, 167, 0, 0.12)',
              border: '1px solid rgba(204, 167, 0, 0.4)',
              color: 'var(--vscode-foreground, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                color: '#facc15',
              }}
            >
              <span>⚠️</span>
              <span>Scope Change Requested</span>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)' }}>
              {scopeChange.reason}
            </div>
            <div style={{ fontSize: '11px' }}>
              <strong>Unplanned files:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {scopeChange.unplannedFiles.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontFamily: 'monospace',
                      padding: '2px 6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleApproveScope}
                style={{
                  padding: '5px 12px',
                  backgroundColor: 'var(--vscode-button-background, #0078d4)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                Approve Scope
              </button>
              <button
                type="button"
                onClick={handleRejectScope}
                style={{
                  padding: '5px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#cccccc',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Reject Scope
              </button>
            </div>
          </div>
        )}

        {/* Pending / recent proposed edits requiring user review */}
        {proposals.length > 0 && (
          <div
            data-testid="proposals-container"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              margin: '6px 0',
            }}
          >
            {proposals.map((prop) => (
              <ApprovalCard
                key={prop.proposalId}
                proposalId={prop.proposalId}
                filePath={prop.filePath}
                files={prop.files}
                diffSummary={prop.diffSummary}
                status={prop.status}
                onReviewDiff={handleReviewDiff}
                onApprove={handleApproveProposal}
                onReject={handleRejectProposal}
              />
            ))}
          </div>
        )}

        {/* Status detail when processing */}
        {status === 'PROCESSING' && (
          <div
            data-testid="processing-indicator"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'rgba(0, 120, 212, 0.12)',
              color: '#60a5fa',
              border: '1px solid rgba(0, 120, 212, 0.25)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
              ⏳
            </span>
            <span style={{ fontWeight: 500 }}>
              {statusDetail || 'JAGGU is processing your request...'}
            </span>
          </div>
        )}

        {/* Error notification */}
        {errorMessage && (
          <div
            data-testid="error-banner"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              title="Dismiss error"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0 4px',
                lineHeight: 1,
                opacity: 0.8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
            >
              ✕
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Floating Prompt Input Area (Antigravity & Claude Style) */}
      <div
        style={{
          padding: '12px 14px 14px',
          borderTop:
            '1px solid var(--vscode-sideBarSectionHeader-border, rgba(255, 255, 255, 0.08))',
          backgroundColor: 'var(--vscode-sideBar-background, #18181b)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {/* Attached Workspace Files Chips */}
        <AttachedFilesBar
          files={attachedFiles}
          onRemove={handleRemoveAttachedFile}
          onClearAll={handleClearAttachedFiles}
        />

        <form onSubmit={handleSubmit}>
          <div
            style={{
              position: 'relative',
              backgroundColor: 'var(--vscode-input-background, #222226)',
              border: '1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.12))',
              borderRadius: '10px',
              padding: '10px 12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* @file Mention Autocomplete Dropdown */}
            {mentionQuery !== null && (
              <FileMentionDropdown
                files={workspaceFiles}
                query={mentionQuery}
                selectedIndex={mentionIndex}
                onSelect={handleSelectMention}
                onClose={() => setMentionQuery(null)}
              />
            )}

            <textarea
              ref={textareaRef}
              data-testid="prompt-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a task... Type @ to reference files (Enter ↵ to send, Shift+Enter for newline)"
              rows={2}
              disabled={status === 'PROCESSING'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--vscode-input-foreground, #ffffff)',
                fontSize: '12.5px',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
                minHeight: '44px',
                maxHeight: '160px',
                overflowY: 'auto',
              }}
            />

            {/* Inner Controls Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '4px',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: '#93c5fd',
                  }}
                >
                  @workspace
                </span>

                {/* Collapsible Execution Terminal Toggle Button */}
                <button
                  type="button"
                  data-testid="terminal-toggle-btn"
                  onClick={() => setIsTerminalOpen((prev) => !prev)}
                  title="Toggle execution terminal drawer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: isTerminalOpen
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: isTerminalOpen
                      ? '1px solid rgba(59, 130, 246, 0.35)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    color: isTerminalOpen ? '#93c5fd' : 'rgba(255, 255, 255, 0.65)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isTerminalOpen
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  <span>&gt;_</span>
                  <span>Terminal</span>
                  {terminalLogs.length > 0 && (
                    <span style={{ opacity: 0.65, fontSize: '9px' }}>({terminalLogs.length})</span>
                  )}
                </button>

                {availableModels.length > 0 && (
                  <ModelSelector
                    models={availableModels}
                    activeModelId={activeModelId}
                    onSelectModel={handleModelSelect}
                    onRefreshHealth={handleRefreshHealth}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <VoiceTypingButton
                  onTranscript={handleVoiceTranscript}
                  disabled={status === 'PROCESSING'}
                />
                {status === 'PROCESSING' ? (
                  <button
                    data-testid="cancel-btn"
                    type="button"
                    onClick={handleCancel}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>■</span>
                    <span>Cancel</span>
                  </button>
                ) : (
                  <button
                    data-testid="submit-btn"
                    type="submit"
                    disabled={!input.trim() && attachedFiles.length === 0}
                    style={{
                      padding: '5px 14px',
                      backgroundColor:
                        input.trim() || attachedFiles.length > 0
                          ? 'var(--vscode-button-background, #0078d4)'
                          : 'rgba(255, 255, 255, 0.08)',
                      color:
                        input.trim() || attachedFiles.length > 0
                          ? 'var(--vscode-button-foreground, #ffffff)'
                          : 'var(--vscode-disabledForeground, #71717a)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor:
                        input.trim() || attachedFiles.length > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                      boxShadow:
                        input.trim() || attachedFiles.length > 0
                          ? '0 2px 8px rgba(0, 120, 212, 0.35)'
                          : 'none',
                    }}
                  >
                    <span>Send</span>
                    <span>↑</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Collapsible Terminal & Execution Output Drawer */}
        <ExecutionDrawer
          isOpen={isTerminalOpen}
          logs={terminalLogs}
          onToggle={() => setIsTerminalOpen((prev) => !prev)}
          onClear={() => setTerminalLogs([])}
        />
      </div>
    </div>
  );
};
