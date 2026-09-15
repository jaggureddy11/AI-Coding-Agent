import React, { useState, useEffect, useRef } from 'react';
import type { UiAgentStatus, ContextSnippetSummary, ModelDescriptor } from '@jaggu/core';
import { StatusPill } from './components/StatusPill.js';
import { ContextPill } from './components/ContextPill.js';
import { ApprovalCard, ApprovalFileItem } from './components/ApprovalCard.js';
import { PlanCard, PlanStepItem } from './components/PlanCard.js';
import { ModelSelector } from './components/ModelSelector.js';
import { VoiceTypingButton } from './components/VoiceTypingButton.js';
import { TrustBadgeBar } from './components/TrustBadgeBar.js';
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
  const [activeModelId, setActiveModelId] = useState<string>('mock-fast');

  const activeProvenanceRef = useRef<ContextSnippetSummary[] | undefined>();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

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
            return [
              ...filtered,
              { proposalId, filePath, diffSummary, status: 'pending' },
            ];
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
          if (msg.payload.model) {
            setActiveModelId(msg.payload.model);
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
        case 'agent.error':
          setErrorMessage(msg.payload.message);
          setStatus('ERROR');
          break;
        case 'TASK_ERROR':
          setErrorMessage(msg.payload.error);
          setStatus('ERROR');
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Notify extension that webview is ready
    vscode?.postMessage({
      type: 'ui.ready',
      payload: { timestamp: Date.now() },
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
    setErrorMessage(null);

    // Send typed RPC to extension host
    vscode?.postMessage({
      type: 'user.submit',
      payload: {
        id: userMsg.id,
        text: trimmed,
        timestamp: userMsg.timestamp,
      },
    });
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
      prev.map((p) => (p.proposalId === proposalId ? { ...p, status: 'approved' } : p))
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
      prev.map((p) => (p.proposalId === proposalId ? { ...p, status: 'rejected' } : p))
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
        fontFamily: 'var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
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
          padding: '8px 12px',
          borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border, rgba(255, 255, 255, 0.08))',
          backgroundColor: 'var(--vscode-sideBarSectionHeader-background, rgba(0, 0, 0, 0.15))',
          backdropFilter: 'blur(8px)',
          minHeight: '42px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Coding Glasses Icon */}
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--vscode-foreground, #ffffff)',
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="8.5" height="9.5" rx="3" />
              <rect x="13.5" y="6" width="8.5" height="9.5" rx="3" />
              <path d="M10.5 9.5a2 2 0 0 1 3 0" />
              <path d="M2 9.5H1" />
              <path d="M23 9.5h-1" />
              <path d="M7.5 9L5.5 10.75L7.5 12.5" />
              <path d="M16.5 9L18.5 10.75L16.5 12.5" />
            </svg>
          </div>

          <span
            style={{
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.04em',
              color: 'var(--vscode-foreground, #ffffff)',
            }}
          >
            JAGGU
          </span>

          <span
            data-testid="provider-badge"
            style={{
              fontSize: '9px',
              padding: '2px 5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            {activeConfig.provider}
          </span>

          {availableModels.length > 0 && (
            <ModelSelector
              models={availableModels}
              activeModelId={activeModelId}
              onSelectModel={handleModelSelect}
              onRefreshHealth={handleRefreshHealth}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <StatusPill state={status} />
          {messages.length > 0 && (
            <button
              data-testid="clear-btn"
              onClick={handleClear}
              title="Clear conversation and start fresh task"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--vscode-descriptionForeground, #858585)',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 500,
              }}
            >
              <span>+</span>
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Trust & Safe Execution Guarantee Bar */}
      <TrustBadgeBar state={status} />

      {/* 2. Conversation Area */}
      <div
        data-testid="conversation-area"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {messages.length === 0 ? (
          <div
            data-testid="empty-state"
            style={{
              margin: 'auto 0',
              textAlign: 'center',
              padding: '24px 12px',
              color: 'var(--vscode-descriptionForeground, #858585)',
            }}
          >
            {/* Glowing Hero Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.15))',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                color: '#ffffff',
              }}
            >
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--vscode-foreground, #ffffff)',
                marginBottom: '6px',
                letterSpacing: '-0.01em',
              }}
            >
              What would you like me to build?
            </div>
            <p style={{ fontSize: '12px', lineHeight: 1.5, margin: '0 auto 16px', maxWidth: '300px', opacity: 0.85 }}>
              Delegate multi-file implementations, refactoring, and test repairs without losing code control.
            </p>

            {/* Core Trust Guarantees */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '6px',
                margin: '0 auto 18px',
                maxWidth: '320px',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  padding: '3px 7px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(52, 211, 153, 0.1)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                  fontWeight: 500,
                }}
              >
                ✓ Review-Gated
              </span>
              <span
                style={{
                  fontSize: '10px',
                  padding: '3px 7px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontWeight: 500,
                }}
              >
                ✓ Shadow Buffer
              </span>
              <span
                style={{
                  fontSize: '10px',
                  padding: '3px 7px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(167, 139, 250, 0.1)',
                  color: '#c084fc',
                  border: '1px solid rgba(167, 139, 250, 0.25)',
                  fontWeight: 500,
                }}
              >
                ✓ Self-Healing Tests
              </span>
            </div>

            {/* Quick Prompt Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px', margin: '0 auto' }}>
              {[
                { title: 'Explain this project', desc: 'Index symbols & trace architecture' },
                { title: 'Plan a new feature', desc: 'Formulate a verified multi-phase plan' },
                { title: 'Diagnose compiler & test errors', desc: 'Collect LSP diagnostics and fix root cause' },
              ].map((item) => (
                <button
                  key={item.title}
                  onClick={() => setInput(item.title)}
                  style={{
                    padding: '9px 12px',
                    textAlign: 'left',
                    fontSize: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--vscode-foreground, #e4e4e7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span style={{ fontSize: '14px', color: '#60a5fa' }}>⚡</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontWeight: 500 }}>{item.title}</span>
                    <span style={{ fontSize: '10.5px', color: 'var(--vscode-descriptionForeground, #858585)' }}>{item.desc}</span>
                  </div>
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
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>JAGGU</span>
                    <span>•</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  backgroundColor:
                    msg.role === 'user'
                      ? 'var(--vscode-button-background, #0078d4)'
                      : 'rgba(255, 255, 255, 0.05)',
                  color:
                    msg.role === 'user'
                      ? 'var(--vscode-button-foreground, #ffffff)'
                      : 'var(--vscode-foreground, #e4e4e7)',
                  border:
                    msg.role === 'user'
                      ? 'none'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow:
                    msg.role === 'user'
                      ? '0 2px 8px rgba(0, 120, 212, 0.3)'
                      : '0 2px 8px rgba(0, 0, 0, 0.15)',
                }}
              >
                {msg.text}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#facc15' }}>
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
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
            <span style={{ fontWeight: 500 }}>{statusDetail || 'JAGGU is processing your request...'}</span>
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
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Floating Prompt Input Area (Antigravity & Claude Style) */}
      <div
        style={{
          padding: '12px 14px 14px',
          borderTop: '1px solid var(--vscode-sideBarSectionHeader-border, rgba(255, 255, 255, 0.08))',
          backgroundColor: 'var(--vscode-sideBar-background, #18181b)',
        }}
      >
        <form onSubmit={handleSubmit}>
          <div
            style={{
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
            <textarea
              data-testid="prompt-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a task... (Enter to send, Shift+Enter for newline)"
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
              }}
            />

            {/* Inner Controls Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--vscode-descriptionForeground, #858585)' }}>
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
                <span>
                  Status: <span style={{ fontWeight: 500, color: 'var(--vscode-foreground, #cccccc)' }}>● {status === 'IDLE' ? 'Ready' : status}</span>
                </span>
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
                    disabled={!input.trim()}
                    style={{
                      padding: '5px 14px',
                      backgroundColor: input.trim()
                        ? 'var(--vscode-button-background, #0078d4)'
                        : 'rgba(255, 255, 255, 0.08)',
                      color: input.trim()
                        ? 'var(--vscode-button-foreground, #ffffff)'
                        : 'var(--vscode-disabledForeground, #71717a)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: input.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                      boxShadow: input.trim() ? '0 2px 8px rgba(0, 120, 212, 0.35)' : 'none',
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
      </div>
    </div>
  );
};
