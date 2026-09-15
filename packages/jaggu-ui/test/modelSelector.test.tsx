import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ModelSelector } from '../src/components/ModelSelector.js';
import { ModelDescriptor } from '@jaggu/core';

describe('JAGGU UI ModelSelector (M7-A)', () => {
  const sampleModels: ModelDescriptor[] = [
    {
      id: 'qwen2.5-coder:7b',
      displayName: 'Qwen 2.5 Coder 7B',
      providerId: 'ollama',
      runtimeType: 'local',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      capabilities: {
        streaming: true,
        toolCalling: true,
        structuredOutput: true,
        vision: false,
      },
      health: 'available',
    },
    {
      id: 'deepseek-r1:8b',
      displayName: 'DeepSeek-R1 8B',
      providerId: 'ollama',
      runtimeType: 'local',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      capabilities: {
        streaming: true,
        toolCalling: false,
        structuredOutput: false,
        vision: false,
      },
      health: 'unreachable',
      healthDetail: 'Ollama daemon connection failed',
    },
    {
      id: 'gpt-4o',
      displayName: 'GPT-4o (Omni)',
      providerId: 'openai',
      runtimeType: 'cloud',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      capabilities: {
        streaming: true,
        toolCalling: true,
        structuredOutput: true,
        vision: true,
      },
      health: 'missing_credentials',
    },
  ];

  it('should render ModelSelector with Local and Cloud option groups', () => {
    const html = renderToString(
      <ModelSelector
        models={sampleModels}
        activeModelId="qwen2.5-coder:7b"
        onSelectModel={() => {}}
      />,
    );

    expect(html).toContain('optgroup label="LOCAL (OLLAMA / VLLM)"');
    expect(html).toContain('optgroup label="CONFIGURED (OPTIONAL CLOUD)"');
    expect(html).toContain('Qwen 2.5 Coder 7B');
    expect(html).toContain('GPT-4o (Omni)');
    expect(html).toContain('data-testid="model-selector"');
  });

  it('should annotate models without tool calling capability', () => {
    const html = renderToString(
      <ModelSelector
        models={sampleModels}
        activeModelId="deepseek-r1:8b"
        onSelectModel={() => {}}
      />,
    );

    expect(html).toContain('DeepSeek-R1 8B [No Tools]');
  });

  it('should render local runtime badge when local model is active', () => {
    const html = renderToString(
      <ModelSelector
        models={sampleModels}
        activeModelId="qwen2.5-coder:7b"
        onSelectModel={() => {}}
      />,
    );

    expect(html).toContain('data-testid="model-runtime-badge"');
    expect(html.toLowerCase()).toContain('local');
  });

  it('should render cloud runtime badge when cloud model is active', () => {
    const html = renderToString(
      <ModelSelector
        models={sampleModels}
        activeModelId="gpt-4o"
        onSelectModel={() => {}}
      />,
    );

    expect(html).toContain('data-testid="model-runtime-badge"');
    expect(html.toLowerCase()).toContain('cloud');
  });

  it('should display health status indicator dot and tooltip', () => {
    const availableHtml = renderToString(
      <ModelSelector
        models={sampleModels}
        activeModelId="qwen2.5-coder:7b"
        onSelectModel={() => {}}
      />,
    );
    expect(availableHtml).toContain('data-testid="model-health-dot"');
    expect(availableHtml).toContain('title="Available"');

    const unreachableHtml = renderToString(
      <ModelSelector
        models={sampleModels}
        activeModelId="deepseek-r1:8b"
        onSelectModel={() => {}}
      />,
    );
    expect(unreachableHtml).toContain(
      'title="Endpoint Unreachable: Ollama daemon connection failed"',
    );
  });

  it('should render refresh health button when onRefreshHealth is supplied', () => {
    const html = renderToString(
      <ModelSelector
        models={sampleModels}
        activeModelId="qwen2.5-coder:7b"
        onSelectModel={() => {}}
        onRefreshHealth={() => {}}
      />,
    );

    expect(html).toContain('data-testid="refresh-health-btn"');
    expect(html).toContain('title="Check provider availability"');
  });
});
