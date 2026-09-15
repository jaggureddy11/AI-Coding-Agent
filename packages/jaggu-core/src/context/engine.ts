import * as fs from 'fs';
import * as path from 'path';
import {
  ContextBudgetPolicy,
  DEFAULT_CONTEXT_BUDGET_POLICY,
  ContextPackage,
  ContextSnippet,
  ActiveEditorContext,
  SearchMatch,
} from './types.js';
import { WorkspaceDiscovery } from './workspace.js';
import { RipgrepSearchService } from './ripgrep.js';
import { RepositoryMap } from './repoMap.js';
import { PromptInjectionSanitizer } from './promptInjection.js';
import { EventBus } from '../events/eventBus.js';

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'for', 'to', 'of',
  'with', 'by', 'how', 'what', 'where', 'why', 'who', 'does', 'project', 'code',
  'this', 'that', 'implemented', 'explain', 'show', 'tell', 'me', 'please', 'find',
]);

/**
 * Identifies sensitive credential or secret files that should not be automatically
 * injected into context packages unless explicitly targeted by the developer.
 */
export function isSensitiveFilePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(normalized);
  if (base === '.env' || base.startsWith('.env.') || base.endsWith('.env')) return true;
  if (base.endsWith('.pem') || base.endsWith('.key') || base.endsWith('.pfx') || base.endsWith('.pkcs12')) return true;
  if (base === 'id_rsa' || base === 'id_ed25519' || base === 'id_ecdsa' || base === 'id_dsa') return true;
  if (base === 'credentials.json' || base === 'service-account.json') return true;
  if (normalized.includes('.git/config') || normalized.includes('.git/credentials')) return true;
  return false;
}

export class ContextEngine {
  private readonly _repoMap: RepositoryMap;
  private readonly _ripgrep: RipgrepSearchService;

  constructor(
    private readonly discovery: WorkspaceDiscovery,
    ripgrep?: RipgrepSearchService,
    repoMap?: RepositoryMap,
    private readonly budgetPolicy: ContextBudgetPolicy = DEFAULT_CONTEXT_BUDGET_POLICY,
  ) {
    this._ripgrep = ripgrep || new RipgrepSearchService();
    this._repoMap = repoMap || new RepositoryMap(discovery);
  }

  public getRepoMap(): RepositoryMap {
    return this._repoMap;
  }

  public getDiscovery(): WorkspaceDiscovery {
    return this.discovery;
  }

  public getWorkspaceRoots(): string[] {
    return this.discovery.getRoots();
  }

  public setWorkspaceRoots(roots: string[]): void {
    this.discovery.setRoots(roots);
    this._repoMap.clear();
  }

  public async initialize(): Promise<void> {
    if (!this._repoMap.isInitialized()) {
      await this._repoMap.initialize();
    }
  }

  /**
   * Assembles a bounded, ranked, grounded context package for a given user prompt.
   */
  public async assembleContext(
    prompt: string,
    activeEditor?: ActiveEditorContext,
    abortSignal?: AbortSignal,
    eventBus?: EventBus,
    taskId: string = 'task_ctx',
  ): Promise<ContextPackage> {
    await this.initialize();

    eventBus?.emit('context.search_started', {
      taskId,
      query: prompt,
      timestamp: Date.now(),
    });

    const candidates: ContextSnippet[] = [];
    const roots = this.discovery.getRoots();
    const primaryRoot = roots[0] || process.cwd();

    try {
      // 1. Tier 1 & 2: Active Editor Context (if open)
      if (activeEditor?.filePath && fs.existsSync(activeEditor.filePath)) {
        const relPath = path.relative(primaryRoot, activeEditor.filePath).replace(/\\/g, '/');

        if (activeEditor.selectedText && activeEditor.selectedText.trim().length > 0) {
          // Explicit user highlight: Highest priority (Score: 1.0)
          const startLine = activeEditor.cursorLine || 1;
          const lineCount = activeEditor.selectedText.split('\n').length;
          candidates.push({
            filePath: activeEditor.filePath,
            relativeFilePath: relPath,
            startLine,
            endLine: startLine + lineCount - 1,
            content: activeEditor.selectedText,
            byteSize: Buffer.byteLength(activeEditor.selectedText, 'utf8'),
            reason: 'active_selection',
            score: 1.0,
          });
        } else {
          // Active file surrounding window (Score: 0.95)
          const content = await fs.promises.readFile(activeEditor.filePath, 'utf8');
          const lines = content.split('\n');
          const cursor = activeEditor.cursorLine || 1;
          const start = Math.max(1, cursor - 30);
          const end = Math.min(lines.length, cursor + 50);
          const snippetLines = lines.slice(start - 1, end).join('\n');

          candidates.push({
            filePath: activeEditor.filePath,
            relativeFilePath: relPath,
            startLine: start,
            endLine: end,
            content: snippetLines,
            byteSize: Buffer.byteLength(snippetLines, 'utf8'),
            reason: 'active_file',
            score: 0.95,
          });
        }
      }

      if (abortSignal?.aborted) {
        return this.createEmptyPackage(prompt);
      }

      // 2. Query Understanding & Keyword Extraction
      const keywords = this.extractKeywords(prompt);

      // 3. Explicit File Reference Matching (Score: 0.90)
      for (const token of prompt.split(/\s+/)) {
        const cleanToken = token.replace(/['"`,:;!?()]/g, '');
        if (cleanToken.includes('/') || cleanToken.includes('.')) {
          const matched = this._repoMap.findFilesByName(cleanToken);
          for (const file of matched.slice(0, 2)) {
            if (!candidates.some((c) => c.relativeFilePath === file.relativePath)) {
              const snippet = await this.loadFileSnippet(file.absolutePath, file.relativePath, 1, 80, 'explicit_reference', 0.9);
              if (snippet) candidates.push(snippet);
            }
          }
        }
      }

      if (abortSignal?.aborted) {
        return this.createEmptyPackage(prompt);
      }

      // 4. Filename Keyword Matching (Score: 0.85)
      for (const kw of keywords) {
        if (kw.length < 3) continue;
        const matched = this._repoMap.findFilesByName(kw);
        for (const file of matched.slice(0, 3)) {
          if (isSensitiveFilePath(file.relativePath) && !prompt.toLowerCase().includes(path.basename(file.relativePath).toLowerCase())) {
            continue; // Shield sensitive credential files from automatic context inclusion
          }
          if (!candidates.some((c) => c.relativeFilePath === file.relativePath)) {
            const isSource = file.classification === 'source';
            const score = isSource ? 0.90 : 0.80;
            const snippet = await this.loadFileSnippet(file.absolutePath, file.relativePath, 1, 80, 'filename_match', score);
            if (snippet) candidates.push(snippet);
          }
        }
      }

      if (abortSignal?.aborted) {
        return this.createEmptyPackage(prompt);
      }

      // 5. Ripgrep Keyword Text Search (Score: 0.70 - 0.85)
      const topKeywords = keywords.slice(0, 4);
      for (const kw of topKeywords) {
        if (kw.length < 3) continue;
        if (abortSignal?.aborted) break;

        const matches: SearchMatch[] = await this._ripgrep.searchText(
          {
            query: kw,
            maxResults: 15,
            caseSensitive: false,
            abortSignal,
          },
          primaryRoot,
        );

        for (const match of matches) {
          if (isSensitiveFilePath(match.relativeFilePath) && !prompt.toLowerCase().includes(path.basename(match.relativeFilePath).toLowerCase())) {
            continue; // Shield sensitive credential files from automatic context inclusion
          }
          if (candidates.some((c) => c.relativeFilePath === match.relativeFilePath)) {
            continue;
          }

          const fileMeta = this._repoMap.getFile(match.relativeFilePath);
          let baseScore = 0.75;
          if (fileMeta?.classification === 'source') {
            baseScore = 0.85; // Source files prioritized for implementation queries
          } else if (fileMeta?.classification === 'documentation') {
            baseScore = 0.65; // Documentation is lower tier (Tier 8)
          }

          const windowSnippet = await this.extractMatchWindow(
            match.filePath,
            match.relativeFilePath,
            match.lineNumber,
            'text_search_match',
            baseScore,
          );
          if (windowSnippet) {
            candidates.push(windowSnippet);
          }
          if (candidates.length >= this.budgetPolicy.maxFiles * 2) {
            break;
          }
        }
      }

      // 6. Test File Pairing (Score: 0.60)
      for (const cand of [...candidates]) {
        if (cand.reason === 'active_file' || cand.reason === 'text_search_match') {
          const testFile = this.findPairedTest(cand.relativeFilePath);
          if (testFile && !candidates.some((c) => c.relativeFilePath === testFile.relativePath)) {
            const testSnippet = await this.loadFileSnippet(testFile.absolutePath, testFile.relativePath, 1, 60, 'test_pairing', 0.6);
            if (testSnippet) candidates.push(testSnippet);
          }
        }
      }
    } catch (err: unknown) {
      eventBus?.emit('context.error', {
        taskId,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      });
    }

    eventBus?.emit('context.search_completed', {
      taskId,
      matchesFound: candidates.length,
      timestamp: Date.now(),
    });

    // 7. Relevance Ranking & Budget Enforcement
    candidates.sort((a, b) => b.score - a.score);

    const selectedSnippets: ContextSnippet[] = [];
    let currentBytes = 0;
    let currentTokens = 0;
    let truncated = false;
    const seenFiles = new Set<string>();

    for (const cand of candidates) {
      if (seenFiles.size >= this.budgetPolicy.maxFiles && !seenFiles.has(cand.relativeFilePath)) {
        truncated = true;
        continue;
      }

      // Enforce per-file byte limit
      let snippetContent = cand.content;
      if (cand.byteSize > this.budgetPolicy.maxBytesPerFile) {
        snippetContent = snippetContent.slice(0, this.budgetPolicy.maxBytesPerFile) + '\n... [truncated]';
      }

      const snippetBytes = Buffer.byteLength(snippetContent, 'utf8');
      const estimatedTokens = Math.ceil(snippetBytes / 4);

      if (
        currentBytes + snippetBytes > this.budgetPolicy.maxTotalContextBytes ||
        currentTokens + estimatedTokens > this.budgetPolicy.maxContextTokens
      ) {
        truncated = true;
        break;
      }

      const finalSnippet: ContextSnippet = {
        ...cand,
        content: snippetContent,
        byteSize: snippetBytes,
      };

      selectedSnippets.push(finalSnippet);
      seenFiles.add(cand.relativeFilePath);
      currentBytes += snippetBytes;
      currentTokens += estimatedTokens;

      eventBus?.emit('context.file_selected', {
        taskId,
        filePath: cand.relativeFilePath,
        reason: cand.reason,
        score: cand.score,
        timestamp: Date.now(),
      });
    }

    const provenance = selectedSnippets.map((s) => ({
      relativeFilePath: s.relativeFilePath,
      startLine: s.startLine,
      endLine: s.endLine,
      reason: s.reason,
      score: s.score,
      byteSize: s.byteSize,
    }));

    const promptContextText = PromptInjectionSanitizer.formatSafeContextBlock(selectedSnippets);

    const pkg: ContextPackage = {
      snippets: selectedSnippets,
      totalEstimatedTokens: currentTokens,
      totalBytes: currentBytes,
      filesCount: seenFiles.size,
      truncated,
      query: prompt,
      provenance,
      promptContextText,
    };

    eventBus?.emit('context.assembled', {
      taskId,
      filesCount: pkg.filesCount,
      totalTokens: pkg.totalEstimatedTokens,
      truncated: pkg.truncated,
      timestamp: Date.now(),
    });

    return pkg;
  }

  public extractKeywords(prompt: string): string[] {
    const rawTokens = prompt
      .toLowerCase()
      .replace(/[^a-z0-9_\-\s/.]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

    const keywords = new Set<string>();

    for (const token of rawTokens) {
      keywords.add(token);

      if (token.startsWith('auth')) {
        keywords.add('auth');
      }
      if (token.endsWith('tion') && token.length > 6) {
        keywords.add(token.slice(0, -4));
      }
      if (token.endsWith('ing') && token.length > 5) {
        keywords.add(token.slice(0, -3));
      }
      if (token.endsWith('ment') && token.length > 6) {
        keywords.add(token.slice(0, -4));
      }

      // Split camelCase or snake_case
      const subTokens = token.split(/[-_]/);
      if (subTokens.length > 1) {
        for (const sub of subTokens) {
          if (sub.length > 2 && !STOP_WORDS.has(sub)) {
            keywords.add(sub);
          }
        }
      }
    }

    return Array.from(keywords);
  }

  private async loadFileSnippet(
    absPath: string,
    relPath: string,
    startLine: number,
    endLine: number,
    reason: ContextSnippet['reason'],
    score: number,
  ): Promise<ContextSnippet | null> {
    try {
      if (!fs.existsSync(absPath)) return null;
      const content = await fs.promises.readFile(absPath, 'utf8');
      const lines = content.split('\n');
      const end = Math.min(lines.length, endLine);
      const snippetContent = lines.slice(startLine - 1, end).join('\n');

      return {
        filePath: absPath,
        relativeFilePath: relPath,
        startLine,
        endLine: end,
        content: snippetContent,
        byteSize: Buffer.byteLength(snippetContent, 'utf8'),
        reason,
        score,
      };
    } catch {
      return null;
    }
  }

  private async extractMatchWindow(
    absPath: string,
    relPath: string,
    matchLine: number,
    reason: ContextSnippet['reason'],
    score: number,
  ): Promise<ContextSnippet | null> {
    try {
      if (!fs.existsSync(absPath)) return null;
      const content = await fs.promises.readFile(absPath, 'utf8');
      const lines = content.split('\n');
      const start = Math.max(1, matchLine - 25);
      const end = Math.min(lines.length, matchLine + 35);
      const windowText = lines.slice(start - 1, end).join('\n');

      return {
        filePath: absPath,
        relativeFilePath: relPath,
        startLine: start,
        endLine: end,
        content: windowText,
        byteSize: Buffer.byteLength(windowText, 'utf8'),
        reason,
        score,
      };
    } catch {
      return null;
    }
  }

  private findPairedTest(relPath: string) {
    const ext = path.extname(relPath);
    const withoutExt = relPath.slice(0, -ext.length);
    const candidateTest1 = `${withoutExt}.test${ext}`;
    const candidateTest2 = `${withoutExt}.spec${ext}`;
    const candidateTest3 = path.join('test', path.basename(relPath)).replace(/\\/g, '/');

    return (
      this._repoMap.getFile(candidateTest1) ||
      this._repoMap.getFile(candidateTest2) ||
      this._repoMap.getFile(candidateTest3)
    );
  }

  private createEmptyPackage(query: string): ContextPackage {
    return {
      snippets: [],
      totalEstimatedTokens: 0,
      totalBytes: 0,
      filesCount: 0,
      truncated: false,
      query,
      provenance: [],
      promptContextText: '',
    };
  }
}
