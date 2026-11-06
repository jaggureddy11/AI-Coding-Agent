import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BedrockProvider } from '../src/models/bedrock.js';
import { ModelError } from '../src/types/models.js';

describe('BedrockProvider Unit Tests', () => {
  let provider: BedrockProvider;

  beforeEach(() => {
    provider = new BedrockProvider();
    vi.restoreAllMocks();
  });

  it('should expose correct provider metadata and capabilities', () => {
    expect(provider.id).toBe('bedrock');
    expect(provider.name).toBe('AWS Bedrock');
    expect(provider.defaultModel).toBe('au.anthropic.claude-sonnet-4-5-20250929-v1:0');

    const sonnetCap = provider.getCapabilities('anthropic.claude-3-5-sonnet-20241022-v2:0');
    expect(sonnetCap.streaming).toBe(true);
    expect(sonnetCap.toolCalling).toBe(true);
    expect(sonnetCap.maxContextTokens).toBe(200000);
    expect(sonnetCap.maxOutputTokens).toBe(8192);

    const haikuCap = provider.getCapabilities('anthropic.claude-3-5-haiku-20241022-v1:0');
    expect(haikuCap.streaming).toBe(true);
    expect(haikuCap.toolCalling).toBe(true);
    expect(haikuCap.maxContextTokens).toBe(200000);
  });

  it('should stream text chunks and usage from ConverseStream', async () => {
    async function* mockStream() {
      yield {
        contentBlockDelta: {
          delta: { text: 'Hello, ' },
          contentBlockIndex: 0,
        },
      };
      yield {
        contentBlockDelta: {
          delta: { text: 'world!' },
          contentBlockIndex: 0,
        },
      };
      yield {
        metadata: {
          usage: {
            inputTokens: 15,
            outputTokens: 5,
            totalTokens: 20,
          },
        },
      };
    }

    const mockClient = {
      send: vi.fn().mockResolvedValue({
        stream: mockStream(),
      }),
    };

    vi.spyOn(provider, 'getClient').mockReturnValue(mockClient as any);

    const chunks = [];
    for await (const chunk of provider.streamChat(
      [
        { role: 'system', content: 'You are an AI assistant.' },
        { role: 'user', content: 'Say hello' },
      ],
      { model: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ type: 'token', text: 'Hello, ' });
    expect(chunks[1]).toEqual({ type: 'token', text: 'world!' });
    expect(chunks[2].type).toBe('usage');
    if (chunks[2].type === 'usage') {
      expect(chunks[2].promptTokens).toBe(15);
      expect(chunks[2].completionTokens).toBe(5);
      expect(chunks[2].costEstimateUsd).toBeGreaterThan(0);
    }
  });

  it('should stream and assemble tool calls from ConverseStream', async () => {
    async function* mockToolStream() {
      yield {
        contentBlockStart: {
          start: {
            toolUse: {
              toolUseId: 'call_abc123',
              name: 'read_file',
            },
          },
          contentBlockIndex: 0,
        },
      };
      yield {
        contentBlockDelta: {
          delta: {
            toolUse: {
              input: '{"filePath":',
            },
          },
          contentBlockIndex: 0,
        },
      };
      yield {
        contentBlockDelta: {
          delta: {
            toolUse: {
              input: '"src/index.ts"}',
            },
          },
          contentBlockIndex: 0,
        },
      };
      yield {
        contentBlockStop: {
          contentBlockIndex: 0,
        },
      };
    }

    const mockClient = {
      send: vi.fn().mockResolvedValue({
        stream: mockToolStream(),
      }),
    };

    vi.spyOn(provider, 'getClient').mockReturnValue(mockClient as any);

    const chunks = [];
    for await (const chunk of provider.streamChat(
      [{ role: 'user', content: 'Read src/index.ts' }],
      {
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        tools: [
          {
            name: 'read_file',
            description: 'Reads a file',
            parameters: { type: 'object', properties: { filePath: { type: 'string' } } },
          },
        ],
      },
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toEqual({
      type: 'tool_call_start',
      id: 'call_abc123',
      name: 'read_file',
    });
    expect(chunks[1]).toEqual({
      type: 'tool_call_delta',
      id: 'call_abc123',
      argumentsDelta: '{"filePath":',
    });
    expect(chunks[2]).toEqual({
      type: 'tool_call_delta',
      id: 'call_abc123',
      argumentsDelta: '"src/index.ts"}',
    });
    expect(chunks[3]).toEqual({
      type: 'tool_call_complete',
      id: 'call_abc123',
      name: 'read_file',
      arguments: { filePath: 'src/index.ts' },
    });
  });

  it('should group multiple consecutive tool results into a single user message for Bedrock', async () => {
    let capturedInput: any;
    const mockClient = {
      send: vi.fn().mockImplementation((command) => {
        capturedInput = command.input;
        return Promise.resolve({
          stream: (async function* () {
            yield { messageStart: { role: 'assistant' } };
            yield { contentBlockDelta: { delta: { text: 'Done' } } };
            yield { messageStop: { stopReason: 'end_turn' } };
          })(),
        });
      }),
    };
    vi.spyOn(provider, 'getClient').mockReturnValue(mockClient as any);

    const stream = provider.streamChat(
      [
        { role: 'user', content: 'Explore repo' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'tool_1', name: 'list_dir', arguments: '{}' },
            { id: 'tool_2', name: 'read_file', arguments: '{}' },
          ],
        },
        { role: 'tool', toolCallId: 'tool_1', content: 'file1.ts' },
        { role: 'tool', toolCallId: 'tool_2', content: 'contents' },
      ],
      { model: 'au.anthropic.claude-sonnet-4-5-20250929-v1:0' },
    );

    for await (const _ of stream) {
      // consume
    }

    expect(capturedInput).toBeDefined();
    expect(capturedInput.messages).toHaveLength(3); // [user, assistant, user-with-2-tool-results]
    expect(capturedInput.messages[2].role).toBe('user');
    expect(capturedInput.messages[2].content).toHaveLength(2);
    expect(capturedInput.messages[2].content[0].toolResult.toolUseId).toBe('tool_1');
    expect(capturedInput.messages[2].content[1].toolResult.toolUseId).toBe('tool_2');
  });

  it('should map AccessDeniedException to AUTH_FAILURE', async () => {
    const error = new Error('User is not authorized');
    error.name = 'AccessDeniedException';

    const mockClient = {
      send: vi.fn().mockRejectedValue(error),
    };
    vi.spyOn(provider, 'getClient').mockReturnValue(mockClient as any);

    await expect(async () => {
      const stream = provider.streamChat([{ role: 'user', content: 'test' }], {
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      });
      for await (const _ of stream) {
        // empty
      }
    }).rejects.toThrowError(ModelError);
  });
});

