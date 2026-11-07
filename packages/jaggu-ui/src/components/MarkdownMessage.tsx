import React, { useState } from 'react';

interface CodeBlockProps {
  language: string;
  code: string;
  onInsertCode?: (code: string) => void;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code, onInsertCode }) => {
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleInsert = () => {
    if (onInsertCode) {
      onInsertCode(code);
      setInserted(true);
      setTimeout(() => setInserted(false), 2000);
    }
  };

  return (
    <div
      style={{
        margin: '8px 0',
        borderRadius: '6px',
        backgroundColor: '#18181c',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 10px',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '11px',
          color: 'var(--vscode-descriptionForeground, #858585)',
          userSelect: 'none',
        }}
      >
        <span style={{ fontFamily: 'monospace', textTransform: 'lowercase' }}>
          {language || 'code'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onInsertCode && (
            <button
              type="button"
              onClick={handleInsert}
              title="Insert code at cursor in active editor"
              style={{
                background: 'transparent',
                border: 'none',
                color: inserted ? '#4ec9b0' : 'var(--vscode-descriptionForeground, #858585)',
                cursor: 'pointer',
                fontSize: '10.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                borderRadius: '3px',
                transition: 'color 0.15s ease',
              }}
            >
              {inserted ? (
                <>
                  <span>✓</span>
                  <span>Inserted</span>
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </svg>
                  <span>Insert</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code to clipboard"
            style={{
              background: 'transparent',
              border: 'none',
              color: copied ? '#4ec9b0' : 'var(--vscode-descriptionForeground, #858585)',
              cursor: 'pointer',
              fontSize: '10.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '3px',
              transition: 'color 0.15s ease',
            }}
          >
            {copied ? (
              <>
                <span>✓</span>
                <span>Copied</span>
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          overflowX: 'auto',
          fontSize: '11.5px',
          fontFamily:
            'var(--vscode-editor-font-family, "JetBrains Mono", Consolas, Menlo, monospace)',
          lineHeight: 1.5,
          color: 'var(--vscode-editor-foreground, #d4d4d4)',
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
};

export interface MarkdownMessageProps {
  content: string;
  onInsertCode?: (code: string) => void;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, onInsertCode }) => {
  // Parse triple-backtick code blocks
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = content.slice(lastIndex, match.index);
      parts.push(renderInlineFormatting(textChunk, `txt-${lastIndex}`));
    }
    const lang = match[1]?.trim() || '';
    const code = match[2]?.replace(/\n$/, '') || '';
    parts.push(
      <CodeBlock
        key={`code-${match.index}`}
        language={lang}
        code={code}
        onInsertCode={onInsertCode}
      />,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    // Handle streaming unclosed code block at tail
    const unclosedMatch = /^([\s\S]*?)```([a-zA-Z0-9_-]*)\n([\s\S]*)$/.exec(remaining);
    if (unclosedMatch) {
      const preText = unclosedMatch[1];
      const lang = unclosedMatch[2]?.trim() || '';
      const code = unclosedMatch[3] || '';
      if (preText) {
        parts.push(renderInlineFormatting(preText, `txt-${lastIndex}`));
      }
      parts.push(
        <CodeBlock
          key={`code-streaming-${lastIndex}`}
          language={lang}
          code={code}
          onInsertCode={onInsertCode}
        />,
      );
    } else {
      parts.push(renderInlineFormatting(remaining, `txt-${lastIndex}`));
    }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{parts}</div>;
};

function renderTokens(text: string, keyPrefix: string): React.ReactNode {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((token, tIdx) => {
    if (token.startsWith('`') && token.endsWith('`') && token.length > 1) {
      return (
        <code
          key={`${keyPrefix}-t-${tIdx}`}
          style={{
            padding: '1px 5px',
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
            fontSize: '11px',
            color: '#93c5fd',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length > 3) {
      return (
        <strong
          key={`${keyPrefix}-t-${tIdx}`}
          style={{ fontWeight: 600, color: 'var(--vscode-foreground, #ffffff)' }}
        >
          {token.slice(2, -2)}
        </strong>
      );
    }
    return token;
  });
}

function renderInlineFormatting(text: string, keyPrefix: string): React.ReactNode {
  // Split paragraphs by double newlines
  const paragraphs = text.split(/\n\n+/);

  return (
    <React.Fragment key={keyPrefix}>
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim();
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={`${keyPrefix}-h3-${pIdx}`}
              style={{
                margin: '8px 0 4px 0',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--vscode-foreground, #e2e8f0)',
              }}
            >
              {renderTokens(trimmed.slice(4), `${keyPrefix}-h3-${pIdx}`)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={`${keyPrefix}-h2-${pIdx}`}
              style={{
                margin: '10px 0 4px 0',
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--vscode-foreground, #f8fafc)',
              }}
            >
              {renderTokens(trimmed.slice(3), `${keyPrefix}-h2-${pIdx}`)}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2
              key={`${keyPrefix}-h1-${pIdx}`}
              style={{
                margin: '12px 0 6px 0',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--vscode-foreground, #ffffff)',
              }}
            >
              {renderTokens(trimmed.slice(2), `${keyPrefix}-h1-${pIdx}`)}
            </h2>
          );
        }

        const lines = para.split('\n');
        const isBulletList =
          lines.length > 0 && lines.every((l) => /^\s*[-*]\s+/.test(l) || l.trim() === '');
        if (isBulletList) {
          return (
            <ul
              key={`${keyPrefix}-ul-${pIdx}`}
              style={{
                margin: '4px 0 8px 0',
                paddingLeft: '18px',
                lineHeight: 1.5,
              }}
            >
              {lines
                .filter((l) => l.trim().length > 0)
                .map((line, lIdx) => (
                  <li key={`${keyPrefix}-li-${pIdx}-${lIdx}`} style={{ marginBottom: '3px' }}>
                    {renderTokens(
                      line.replace(/^\s*[-*]\s+/, ''),
                      `${keyPrefix}-li-${pIdx}-${lIdx}`,
                    )}
                  </li>
                ))}
            </ul>
          );
        }

        return (
          <p
            key={`${keyPrefix}-p-${pIdx}`}
            style={{
              margin: '0 0 6px 0',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}
          >
            {renderTokens(para, `${keyPrefix}-p-${pIdx}`)}
          </p>
        );
      })}
    </React.Fragment>
  );
}
