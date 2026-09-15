import * as childProcess from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { SearchMatch, SearchQueryOptions } from './types.js';

let defaultRgPath = '';
try {
  const rgModule = typeof require !== 'undefined' ? require('@vscode/ripgrep') : null;
  if (rgModule?.rgPath) {
    defaultRgPath = rgModule.rgPath;
  }
} catch {
  defaultRgPath = '';
}

export class RipgrepSearchService {
  private readonly _rgPath: string;

  constructor(customRgPath?: string) {
    this._rgPath = customRgPath || defaultRgPath;
  }

  public async searchText(
    options: SearchQueryOptions,
    workspaceRoot: string,
  ): Promise<SearchMatch[]> {
    if (!options.query || options.query.trim().length === 0) {
      return [];
    }

    const maxResults = options.maxResults ?? 50;

    // Try native ripgrep binary first
    try {
      if (fs.existsSync(this._rgPath)) {
        return await this.executeNativeRipgrep(options, workspaceRoot, maxResults);
      }
    } catch {
      // Fallback to pure Node.js in-memory scan
    }

    return this.executeFallbackScan(options, workspaceRoot, maxResults);
  }

  public async searchFilenames(
    pattern: string,
    workspaceRoot: string,
    maxResults: number = 50,
    abortSignal?: AbortSignal,
  ): Promise<string[]> {
    if (!pattern || pattern.trim().length === 0) {
      return [];
    }

    try {
      if (fs.existsSync(this._rgPath)) {
        return await new Promise<string[]>((resolve) => {
          const args = [
            '--files',
            '--glob',
            `*${pattern}*`,
            '--max-filesize',
            '2M',
            '--glob',
            '!.git',
            '--glob',
            '!node_modules',
            '--glob',
            '!dist',
            '--glob',
            '!build',
          ];

          const proc = childProcess.spawn(this._rgPath, args, {
            cwd: workspaceRoot,
            stdio: ['ignore', 'pipe', 'ignore'],
          });

          let stdout = '';
          proc.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8');
          });

          const onAbort = () => {
            proc.kill('SIGTERM');
            resolve([]);
          };

          if (abortSignal) {
            if (abortSignal.aborted) {
              return resolve([]);
            }
            abortSignal.addEventListener('abort', onAbort, { once: true });
          }

          proc.on('close', () => {
            abortSignal?.removeEventListener('abort', onAbort);
            const files = stdout
              .split('\n')
              .map((l) => l.trim().replace(/\\/g, '/'))
              .filter((l) => l.length > 0)
              .slice(0, maxResults);
            resolve(files);
          });

          proc.on('error', () => {
            resolve([]);
          });
        });
      }
    } catch {
      // ignore
    }

    return [];
  }

  private executeNativeRipgrep(
    options: SearchQueryOptions,
    workspaceRoot: string,
    maxResults: number,
  ): Promise<SearchMatch[]> {
    return new Promise<SearchMatch[]>((resolve, reject) => {
      const args = [
        '--json',
        '--max-filesize',
        '2M',
        '--glob',
        '!.git',
        '--glob',
        '!node_modules',
        '--glob',
        '!dist',
        '--glob',
        '!build',
        '--glob',
        '!*.min.js',
        '--glob',
        '!*.map',
      ];

      if (!options.caseSensitive) {
        args.push('-i');
      }

      if (!options.isRegex) {
        args.push('-F');
      }

      if (options.globIncludes) {
        for (const inc of options.globIncludes) {
          args.push('--glob', inc);
        }
      }

      if (options.globExcludes) {
        for (const exc of options.globExcludes) {
          args.push('--glob', `!${exc}`);
        }
      }

      args.push(options.query);

      const proc = childProcess.spawn(this._rgPath, args, {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const matches: SearchMatch[] = [];
      let buffer = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'match') {
              const data = parsed.data;
              const relPath = data.path.text.replace(/\\/g, '/');
              const absPath = path.isAbsolute(data.path.text)
                ? data.path.text
                : path.join(workspaceRoot, data.path.text);

              matches.push({
                filePath: absPath,
                relativeFilePath: relPath,
                lineNumber: data.line_number,
                lineContent: data.lines.text.replace(/\r?\n$/, ''),
                column: data.submatches?.[0]?.start,
              });

              if (matches.length >= maxResults) {
                proc.kill('SIGTERM');
                resolve(matches);
                return;
              }
            }
          } catch {
            // Ignore unparseable lines
          }
        }
      });

      const onAbort = () => {
        proc.kill('SIGTERM');
        resolve(matches);
      };

      if (options.abortSignal) {
        if (options.abortSignal.aborted) {
          proc.kill('SIGTERM');
          return resolve([]);
        }
        options.abortSignal.addEventListener('abort', onAbort, { once: true });
      }

      proc.on('close', () => {
        options.abortSignal?.removeEventListener('abort', onAbort);
        resolve(matches);
      });

      proc.on('error', (err) => {
        options.abortSignal?.removeEventListener('abort', onAbort);
        reject(err);
      });
    });
  }

  private async executeFallbackScan(
    options: SearchQueryOptions,
    workspaceRoot: string,
    maxResults: number,
  ): Promise<SearchMatch[]> {
    const matches: SearchMatch[] = [];
    const query = options.caseSensitive ? options.query : options.query.toLowerCase();

    const walk = async (dir: string): Promise<void> => {
      if (matches.length >= maxResults || options.abortSignal?.aborted) return;

      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (matches.length >= maxResults || options.abortSignal?.aborted) break;
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;

        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.promises.stat(full);
            if (stats.size > 2 * 1024 * 1024) continue;

            const content = await fs.promises.readFile(full, 'utf8');
            const lines = content.split('\n');
            const relPath = path.relative(workspaceRoot, full).replace(/\\/g, '/');

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i] || '';
              const searchLine = options.caseSensitive ? line : line.toLowerCase();
              if (searchLine.includes(query)) {
                matches.push({
                  filePath: full,
                  relativeFilePath: relPath,
                  lineNumber: i + 1,
                  lineContent: line,
                });
                if (matches.length >= maxResults) break;
              }
            }
          } catch {
            // ignore
          }
        }
      }
    };

    await walk(workspaceRoot);
    return matches;
  }
}
