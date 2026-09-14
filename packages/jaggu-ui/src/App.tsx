import React, { useState, useEffect, useRef } from 'react';
import type { UiAgentStatus, ContextSnippetSummary } from '@jaggu/core';
import { StatusPill } from './components/StatusPill.js';
import { ContextPill } from './components/ContextPill.js';
import { ApprovalCard, ApprovalFileItem } from './components/ApprovalCard.js';
import { PlanCard, PlanStepItem } from './components/PlanCard.js';
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
          setActiveConfig(msg.payload);
          break;
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

  const handleApproveProposal = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.proposalId === proposalId ? { ...p, status: 'approved' } : p))
    );
    // Support both single proposalId and multi-file editSetId
    vscode?.postMessage({
      type: 'agent.approve',
      payload: { proposalId },
    });
    vscode?.postMessage({
      type: 'agent.editset_approve',
      payload: { editSetId: proposalId },
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
        backgroundColor: 'var(--vscode-sideBar-background, #252526)',
        color: 'var(--vscode-sideBar-foreground, var(--vscode-foreground, #cccccc))',
        fontFamily: 'var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif)',
        fontSize: 'var(--vscode-font-size, 13px)',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header with branding & status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border, rgba(255, 255, 255, 0.08))',
          backgroundColor: 'var(--vscode-sideBarSectionHeader-background, transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.08em',
              color: 'var(--vscode-foreground, #ffffff)',
            }}
          >
            JAGGU
          </span>
          <span
            style={{
              fontSize: '10px',
              opacity: 0.6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Agent
          </span>
          <span
            data-testid="provider-badge"
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '3px',
              backgroundColor: 'var(--vscode-badge-background, rgba(255, 255, 255, 0.08))',
              color: 'var(--vscode-badge-foreground, #858585)',
              textTransform: 'uppercase',
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
                borderRadius: '3px',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 2. Conversation area */}
      <div
        data-testid="conversation-area"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.length === 0 ? (
          <div
            data-testid="empty-state"
            style={{
              margin: 'auto 0',
              textAlign: 'center',
              padding: '20px 10px',
              color: 'var(--vscode-descriptionForeground, #858585)',
            }}
          >
            <div
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--vscode-foreground, #cccccc)',
                marginBottom: '8px',
              }}
            >
              What would you like me to build?
            </div>
            <p style={{ fontSize: '12px', lineHeight: 1.5, margin: '0 auto 16px', maxWidth: '240px' }}>
              Assign tasks, ask architectural questions, or plan code modifications.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '260px', margin: '0 auto' }}>
              {[
                'Explain this project',
                'Plan a new feature',
                'Inspect repository architecture',
              ].map((promptText) => (
                <button
                  key={promptText}
                  onClick={() => setInput(promptText)}
                  style={{
                    padding: '6px 10px',
                    textAlign: 'left',
                    fontSize: '11px',
                    backgroundColor: 'var(--vscode-input-background, rgba(255, 255, 255, 0.04))',
                    color: 'var(--vscode-foreground, #cccccc)',
                    border: '1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.1))',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ {promptText}
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
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--vscode-descriptionForeground, #858585)',
                  marginBottom: '3px',
                  paddingLeft: msg.role === 'user' ? 0 : '4px',
                  paddingRight: msg.role === 'user' ? '4px' : 0,
                }}
              >
                {msg.role === 'user' ? 'You' : 'JAGGU'} •{' '}
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div
                style={{
                  maxWidth: '90%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  backgroundColor:
                    msg.role === 'user'
                      ? 'var(--vscode-button-background, #0e639c)'
                      : 'var(--vscode-editor-inactiveSelectionBackground, rgba(255, 255, 255, 0.06))',
                  color:
                    msg.role === 'user'
                      ? 'var(--vscode-button-foreground, #ffffff)'
                      : 'var(--vscode-foreground, #cccccc)',
                  border:
                    msg.role === 'user'
                      ? 'none'
                      : '1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.08))',
                }}
              >
                {msg.text}
              </div>
              {msg.role === 'assistant' && msg.provenance && msg.provenance.length > 0 && (
                <ContextPill provenance={msg.provenance} />
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
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              backgroundColor: 'var(--vscode-editorWarning-background, #332b00)',
              border: '1px solid var(--vscode-editorWarning-foreground, #cca700)',
              color: 'var(--vscode-foreground, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <span>⚠️</span>
              <span>Scope Change Requested</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground, #cccccc)' }}>
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
                      padding: '2px 5px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '3px',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleApproveScope}
                style={{
                  padding: '4px 10px',
                  backgroundColor: 'var(--vscode-button-background, #0e639c)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '3px',
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
                  padding: '4px 10px',
                  backgroundColor: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: '#cccccc',
                  border: 'none',
                  borderRadius: '3px',
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
              gap: '8px',
              margin: '4px 0',
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
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              backgroundColor: 'rgba(0, 122, 204, 0.1)',
              color: 'var(--vscode-progressBar-background, #007acc)',
              border: '1px solid rgba(0, 122, 204, 0.2)',
            }}
          >
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
            <span>{statusDetail || 'JAGGU is processing your request...'}</span>
          </div>
        )}

        {/* Error notification */}
        {errorMessage && (
          <div
            data-testid="error-banner"
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              backgroundColor: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
              border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
              color: 'var(--vscode-errorForeground, #f48771)',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input & control area */}
      <div
        style={{
          padding: '10px 14px 14px',
          borderTop: '1px solid var(--vscode-sideBarSectionHeader-border, rgba(255, 255, 255, 0.08))',
          backgroundColor: 'var(--vscode-sideBar-background, #252526)',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
              padding: '8px 10px',
              borderRadius: '4px',
              border: '1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.15))',
              backgroundColor: 'var(--vscode-input-background, #3c3c3c)',
              color: 'var(--vscode-input-foreground, #cccccc)',
              fontSize: '12px',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground, #858585)' }}>
              Status: <span style={{ fontWeight: 500, color: 'var(--vscode-foreground, #cccccc)' }}>● {status === 'IDLE' ? 'Ready' : status}</span>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {status === 'PROCESSING' ? (
                <button
                  data-testid="cancel-btn"
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                    color: 'var(--vscode-button-secondaryForeground, #ffffff)',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  data-testid="submit-btn"
                  type="submit"
                  disabled={!input.trim()}
                  style={{
                    padding: '5px 14px',
                    backgroundColor: input.trim()
                      ? 'var(--vscode-button-background, #0e639c)'
                      : 'var(--vscode-button-secondaryBackground, #3a3d41)',
                    color: input.trim()
                      ? 'var(--vscode-button-foreground, #ffffff)'
                      : 'var(--vscode-disabledForeground, #858585)',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
