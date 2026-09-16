import { z } from 'zod';
import { ITool, IToolExecutionContext, IToolResult, PermissionTier } from '../../types/tools.js';
import { ModelToolDefinition } from '../../types/models.js';
import { RipgrepSearchService } from '../../context/ripgrep.js';
import { SearchMatch } from '../../context/types.js';

const SearchCodeInputSchema = z.object({
  query: z.string().min(1, 'Search query must not be empty'),
  isRegex: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  includePattern: z.string().optional(),
  maxResults: z.number().int().positive().optional(),
});

export type SearchCodeInput = z.infer<typeof SearchCodeInputSchema>;

export interface SearchCodeOutput {
  query: string;
  matches: SearchMatch[];
  totalMatches: number;
  truncated: boolean;
}

export class SearchCodeTool implements ITool<SearchCodeInput, SearchCodeOutput> {
  public readonly name = 'search_code';
  public readonly description =
    'Searches repository codebase using ripgrep for exact text, regex, or patterns across workspace files.';
  public readonly permissionTier: PermissionTier = 'SAFE';
  public readonly schema = SearchCodeInputSchema;
  public readonly timeoutMs = 10000;

  constructor(private readonly ripgrepService: RipgrepSearchService = new RipgrepSearchService()) {}

  public toModelToolDefinition(): ModelToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The exact string or regex pattern to search for in the codebase',
          },
          isRegex: {
            type: 'boolean',
            description:
              'Whether the query should be treated as a regular expression (default: false)',
          },
          caseSensitive: {
            type: 'boolean',
            description: 'Whether the search should be case sensitive (default: false)',
          },
          includePattern: {
            type: 'string',
            description: 'Glob pattern to filter files (e.g. "*.ts", "src/**")',
          },
          maxResults: {
            type: 'integer',
            description: 'Maximum number of matches to return (default: 50, max: 200)',
          },
        },
        required: ['query'],
      },
    };
  }

  public async execute(
    args: SearchCodeInput,
    context: IToolExecutionContext,
  ): Promise<IToolResult<SearchCodeOutput>> {
    const startTime = Date.now();
    try {
      const maxResults = Math.min(200, args.maxResults ?? 50);
      const roots = context.workspaceRoots || [context.workspaceRoot];
      const allMatches: SearchMatch[] = [];

      for (const root of roots) {
        if (context.abortSignal.aborted) break;

        const matches = await this.ripgrepService.searchText(
          {
            query: args.query,
            isRegex: args.isRegex,
            caseSensitive: args.caseSensitive,
            globIncludes: args.includePattern ? [args.includePattern] : undefined,
            maxResults: maxResults - allMatches.length,
            abortSignal: context.abortSignal,
          },
          root,
        );

        allMatches.push(...matches);
        if (allMatches.length >= maxResults) break;
      }

      return {
        success: true,
        data: {
          query: args.query,
          matches: allMatches.slice(0, maxResults),
          totalMatches: allMatches.length,
          truncated: allMatches.length >= maxResults,
        },
        executionDurationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        executionDurationMs: Date.now() - startTime,
      };
    }
  }
}
