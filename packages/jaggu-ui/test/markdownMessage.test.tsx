import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MarkdownMessage } from '../src/components/MarkdownMessage.js';

describe('MarkdownMessage Component', () => {
  it('should render plain text correctly', () => {
    const html = renderToString(<MarkdownMessage content="Hello world from JAGGU" />);
    expect(html).toContain('Hello world from JAGGU');
  });

  it('should format code blocks with language badge and copy button', () => {
    const codeSample = '```typescript\nconst x: number = 42;\n```';
    const html = renderToString(<MarkdownMessage content={codeSample} />);
    expect(html).toContain('typescript');
    expect(html).toContain('const x: number = 42;');
    expect(html).toContain('Copy');
  });

  it('should handle code blocks without specified language', () => {
    const codeSample = '```\nconsole.log("no lang");\n```';
    const html = renderToString(<MarkdownMessage content={codeSample} />);
    expect(html).toContain('code');
    expect(html).toContain('console.log(&quot;no lang&quot;);');
  });

  it('should format inline code and bold markdown tokens', () => {
    const mixedText = 'Use the `runCommand` tool to **execute** commands.';
    const html = renderToString(<MarkdownMessage content={mixedText} />);
    expect(html).toContain('>runCommand</code>');
    expect(html).toContain('>execute</strong>');
  });

  it('should handle multiple code blocks interleaved with explanations', () => {
    const doc = `Here is the first step:
\`\`\`bash
npm install
\`\`\`
Next, run the dev server:
\`\`\`bash
npm run dev
\`\`\`
All done!`;

    const html = renderToString(<MarkdownMessage content={doc} />);
    expect(html).toContain('Here is the first step:');
    expect(html).toContain('npm install');
    expect(html).toContain('Next, run the dev server:');
    expect(html).toContain('npm run dev');
    expect(html).toContain('All done!');
  });
});
