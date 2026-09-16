import { z } from 'zod';

export const ToolCallFunctionSchema = z.object({
  name: z.string(),
  arguments: z.string(),
});

export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function').default('function'),
  function: ToolCallFunctionSchema,
});

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().nullable().default(''),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
});

export const ToolDefinitionSchema = z.object({
  type: z.literal('function').default('function'),
  function: z.object({
    name: z.string().min(1),
    description: z.string().optional().default(''),
    parameters: z.record(z.unknown()).optional().default({}),
  }),
});

export const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1, 'Model identifier is required'),
  messages: z.array(ChatMessageSchema).min(1, 'At least one message is required'),
  temperature: z.number().min(0).max(2).optional().default(0.2),
  top_p: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional().default(true),
  max_tokens: z.number().int().positive().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  tools: z.array(ToolDefinitionSchema).optional(),
  tool_choice: z.union([z.string(), z.record(z.unknown())]).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: 'invalid_request_error' | 'authentication_error' | 'rate_limit_error' | 'server_error';
    param?: string | null;
    code?: string | null;
  };
}

export function formatOpenAIError(
  message: string,
  type: OpenAIErrorResponse['error']['type'] = 'server_error',
  code: string | null = null,
  param: string | null = null,
): OpenAIErrorResponse {
  return {
    error: {
      message,
      type,
      code,
      param,
    },
  };
}
