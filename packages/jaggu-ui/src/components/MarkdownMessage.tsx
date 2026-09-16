import React, { useState } from 'react';

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
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
    parts.push(<CodeBlock key={`code-${match.index}`} language={lang} code={code} />);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(renderInlineFormatting(content.slice(lastIndex), `txt-${lastIndex}`));
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{parts}</div>;
};

function renderInlineFormatting(text: string, keyPrefix: string): React.ReactNode {
  // Split paragraphs by double newlines
  const paragraphs = text.split(/\n\n+/);

  return (
    <React.Fragment key={keyPrefix}>
      {paragraphs.map((para, pIdx) => {
        // Handle inline code `code` and bold **bold**
        const tokens = para.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
        return (
          <p
            key={`${keyPrefix}-p-${pIdx}`}
            style={{
              margin: '0 0 6px 0',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}
          >
            {tokens.map((token, tIdx) => {
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
            })}
          </p>
        );
      })}
    </React.Fragment>
  );
}
