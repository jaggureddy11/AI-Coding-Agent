import fs from 'fs';
import path from 'path';
import { getMimeType } from './mime.ts';
import type { ServeOptions, FileResponse } from './types.ts';

export class StaticServer {
  private rootDir: string;
  private defaultFile: string;

  constructor(options: ServeOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.defaultFile = options.defaultFile || 'index.html';
  }

  /**
   * Serves a static file given a URL request path.
   * Defect: Uses naive path.join without verifying that the resolved path stays inside rootDir.
   * Allows directory traversal like `../../secrets.json`.
   */
  serveFile(urlPath: string): FileResponse {
    let target = urlPath;
    if (target === '/' || target === '') {
      target = this.defaultFile;
    }

    // Vulnerable resolution:
    const resolvedPath = path.join(this.rootDir, target);

    if (!fs.existsSync(resolvedPath)) {
      return { statusCode: 404, error: 'File Not Found' };
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      return {
        statusCode: 200,
        contentType: getMimeType(resolvedPath),
        content,
      };
    } catch (err: any) {
      return { statusCode: 500, error: err?.message || 'Read Error' };
    }
  }
}
