import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceFile, FileClassification } from './types.js';

export interface WorkspaceDiscoveryOptions {
  maxDepth?: number;
  maxFiles?: number;
  customExcludes?: string[];
  includeIgnored?: boolean;
}

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.gemini',
  '.vscode',
  'coverage',
  'target',
  'vendor',
  'venv',
  '.venv',
  '__pycache__',
  '.turbo',
  '.next',
  '.cache',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.tiff',
  '.pdf',
  '.exe',
  '.bin',
  '.dll',
  '.so',
  '.dylib',
  '.zip',
  '.tar',
  '.gz',
  '.7z',
  '.rar',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.wasm',
  '.pyc',
  '.class',
  '.o',
  '.obj',
  '.a',
  '.lib',
  '.iso',
  '.dmg',
]);

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'plaintext',
  '.sh': 'shellscript',
  '.bash': 'shellscript',
  '.zsh': 'shellscript',
  '.sql': 'sql',
  '.swift': 'swift',
  '.scala': 'scala',
  '.dart': 'dart',
  '.lua': 'lua',
};

const DEFAULT_SENSITIVE_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|pkcs12|pfx|p12|kdbx)$/i,
  /^id_rsa(_\w+)?$/i,
  /^(credentials|service_account|secret|secrets)\.json$/i,
];

export class WorkspaceDiscovery {
  private workspaceRoots: string[];

  constructor(workspaceRoots: string[]) {
    this.workspaceRoots = [...workspaceRoots];
  }

  public getRoots(): string[] {
    return [...this.workspaceRoots];
  }

  public setRoots(roots: string[]): void {
    this.workspaceRoots = [...roots];
  }

  public async enumerateFiles(options: WorkspaceDiscoveryOptions = {}): Promise<WorkspaceFile[]> {
    const results: WorkspaceFile[] = [];
    const maxFiles = options.maxFiles ?? 20000;
    const maxDepth = options.maxDepth ?? 20;
    const customExcludes = new Set(options.customExcludes || []);

    for (const root of this.workspaceRoots) {
      if (!fs.existsSync(root)) continue;

      await this.scanDir(root, root, 0, maxDepth, maxFiles, customExcludes, results);
      if (results.length >= maxFiles) break;
    }

    return results;
  }

  private async scanDir(
    currentDir: string,
    workspaceRoot: string,
    currentDepth: number,
    maxDepth: number,
    maxFiles: number,
    customExcludes: Set<string>,
    accumulator: WorkspaceFile[],
  ): Promise<void> {
    if (currentDepth > maxDepth || accumulator.length >= maxFiles) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      if (accumulator.length >= maxFiles) break;

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(workspaceRoot, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name) || customExcludes.has(entry.name) || entry.name.startsWith('.')) {
          continue;
        }
        await this.scanDir(fullPath, workspaceRoot, currentDepth + 1, maxDepth, maxFiles, customExcludes, accumulator);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        if (
          customExcludes.has(entry.name) ||
          entry.name === '.DS_Store' ||
          DEFAULT_SENSITIVE_FILE_PATTERNS.some((re) => re.test(entry.name))
        ) {
          continue;
        }

        try {
          const stats = await fs.promises.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          const isBinary = this.detectBinary(fullPath, ext, stats.size);
          const classification = this.classifyFile(relativePath, ext, isBinary);
          const language = EXTENSION_TO_LANGUAGE[ext] || (isBinary ? 'binary' : 'plaintext');

          let lineCount: number | undefined;
          // Count lines only for non-binary files under 1MB to keep discovery fast
          if (!isBinary && stats.size < 1024 * 1024) {
            try {
              const content = await fs.promises.readFile(fullPath, 'utf8');
              lineCount = content.split('\n').length;
            } catch {
              // ignore
            }
          }

          accumulator.push({
            relativePath,
            absolutePath: fullPath,
            sizeBytes: stats.size,
            lineCount,
            language,
            classification,
            isBinary,
            lastModifiedMs: stats.mtimeMs,
          });
        } catch {
          // Ignore inaccessible files
        }
      }
    }
  }

  public detectBinary(filePath: string, ext: string, sizeBytes: number): boolean {
    if (BINARY_EXTENSIONS.has(ext)) {
      return true;
    }
    if (sizeBytes === 0) {
      return false;
    }

    try {
      // Check first 512 bytes for null byte
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(Math.min(512, sizeBytes));
      fs.readSync(fd, buffer, 0, buffer.length, 0);
      fs.closeSync(fd);

      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  public classifyFile(relativePath: string, ext: string, isBinary: boolean): FileClassification {
    if (isBinary) {
      return 'asset';
    }

    const lowerPath = relativePath.toLowerCase();
    const basename = path.basename(lowerPath);

    if (
      basename.includes('.test.') ||
      basename.includes('.spec.') ||
      lowerPath.includes('__tests__') ||
      lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/')
    ) {
      return 'test';
    }

    if (
      basename.endsWith('.md') ||
      basename.endsWith('.markdown') ||
      lowerPath.startsWith('docs/') ||
      lowerPath.includes('/docs/') ||
      basename === 'license' ||
      basename === 'notice'
    ) {
      return 'documentation';
    }

    if (
      basename === 'package.json' ||
      basename === 'tsconfig.json' ||
      basename.startsWith('tsconfig.') ||
      basename.startsWith('.eslint') ||
      basename.startsWith('.prettier') ||
      basename.includes('config.') ||
      basename.startsWith('.env') ||
      basename === 'cargo.toml' ||
      basename === 'go.mod' ||
      basename === 'pyproject.toml' ||
      basename === 'requirements.txt' ||
      basename === 'dockerfile' ||
      ext === '.yaml' ||
      ext === '.yml' ||
      ext === '.toml'
    ) {
      return 'config';
    }

    if (basename.endsWith('.min.js') || basename.endsWith('.min.css') || basename.endsWith('.map')) {
      return 'generated';
    }

    if (EXTENSION_TO_LANGUAGE[ext]) {
      return 'source';
    }

    return 'unknown';
  }
}
