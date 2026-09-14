import { ITool, IToolExecutionContext, IToolResult } from '../types/tools.js';
import { ModelToolDefinition } from '../types/models.js';
import { EventBus } from '../events/eventBus.js';

export interface ToolExecutorOptions {
  eventBus?: EventBus;
}

export class ToolExecutor {
  private readonly tools = new Map<string, ITool>();
  private readonly eventBus?: EventBus;

  constructor(options: ToolExecutorOptions = {}) {
    this.eventBus = options.eventBus;
  }

  public registerTool(tool: ITool): void {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  public listTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  public toModelToolDefinitions(): ModelToolDefinition[] {
    return this.listTools().map((t) => t.toModelToolDefinition());
  }

  public async executeTool(
    toolCallId: string,
    toolName: string,
    rawArgs: unknown,
    context: IToolExecutionContext,
  ): Promise<IToolResult> {
    const startTime = Date.now();

    // 1. Emit tool.requested
    this.eventBus?.emit('tool.requested', {
      taskId: context.taskId,
      toolCallId,
      toolName,
      arguments: (typeof rawArgs === 'object' && rawArgs !== null ? rawArgs : {}) as Record<string, unknown>,
      timestamp: startTime,
    });

    // 2. Check cancellation
    if (context.abortSignal.aborted) {
      this.eventBus?.emit('tool.cancelled', {
        taskId: context.taskId,
        toolCallId,
        toolName,
        timestamp: Date.now(),
      });
      return {
        success: false,
        error: 'Execution cancelled before tool started',
        executionDurationMs: Date.now() - startTime,
      };
    }

    // 3. Find tool
    const tool = this.tools.get(toolName);
    if (!tool) {
      const notFoundError = `Unknown tool: "${toolName}". Available tools: [${Array.from(this.tools.keys()).join(', ')}]`;
      this.eventBus?.emit('tool.failed', {
        taskId: context.taskId,
        toolCallId,
        toolName,
        error: notFoundError,
        timestamp: Date.now(),
      });
      return {
        success: false,
        error: notFoundError,
        executionDurationMs: Date.now() - startTime,
      };
    }

    // 4. Schema validation
    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      const validationError = `Schema validation failed for tool [${toolName}]: ${parsed.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ')}`;

      this.eventBus?.emit('tool.validation_failed', {
        taskId: context.taskId,
        toolCallId,
        toolName,
        error: validationError,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: validationError,
        executionDurationMs: Date.now() - startTime,
      };
    }

    // 5. Emit tool.started
    this.eventBus?.emit('tool.started', {
      taskId: context.taskId,
      toolCallId,
      toolName,
      timestamp: Date.now(),
    });

    // 6. Execute tool with timeout
    try {
      const timeoutPromise = new Promise<IToolResult>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Tool [${toolName}] timed out after ${tool.timeoutMs}ms`));
        }, tool.timeoutMs);

        // Cancel timer if aborted
        context.abortSignal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error(`Tool [${toolName}] cancelled`));
        });
      });

      const result = await Promise.race([
        tool.execute(parsed.data, context),
        timeoutPromise,
      ]);

      const durationMs = Date.now() - startTime;

      if (result.success) {
        this.eventBus?.emit('tool.completed', {
          taskId: context.taskId,
          toolCallId,
          toolName,
          success: true,
          durationMs,
          timestamp: Date.now(),
        });
      } else {
        this.eventBus?.emit('tool.failed', {
          taskId: context.taskId,
          toolCallId,
          toolName,
          error: result.error || 'Tool execution failed',
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const isAbort = context.abortSignal.aborted;

      if (isAbort) {
        this.eventBus?.emit('tool.cancelled', {
          taskId: context.taskId,
          toolCallId,
          toolName,
          timestamp: Date.now(),
        });
        return {
          success: false,
          error: `Tool [${toolName}] cancelled`,
          executionDurationMs: durationMs,
        };
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      this.eventBus?.emit('tool.failed', {
        taskId: context.taskId,
        toolCallId,
        toolName,
        error: errMsg,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: errMsg,
        executionDurationMs: durationMs,
      };
    }
  }
}
