import * as path from 'path';
import * as fs from 'fs';

export class WorkspaceSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: 'PATH_TRAVERSAL_DETECTED' | 'OUTSIDE_WORKSPACE' | 'INVALID_PATH' | 'SYMLINK_ESCAPE',
    public readonly targetPath: string,
  ) {
    super(`[Security ${code}] ${message}: ${targetPath}`);
    this.name = 'WorkspaceSecurityError';
  }
}

/**
 * Validates and resolves an untrusted file or directory path against the authorized workspace roots.
 * Strictly blocks '../' directory traversals, symlink escapes, and paths outside workspace boundaries.
 */
export function resolveAndValidateWorkspacePath(
  untrustedPath: string,
  workspaceRoots: string[],
): string {
  if (!untrustedPath || typeof untrustedPath !== 'string') {
    throw new WorkspaceSecurityError('Empty or invalid path provided', 'INVALID_PATH', untrustedPath);
  }

  // Reject NULL byte injection
  if (untrustedPath.includes('\0')) {
    throw new WorkspaceSecurityError('Path contains null byte characters', 'INVALID_PATH', untrustedPath);
  }

  if (!workspaceRoots || workspaceRoots.length === 0) {
    throw new WorkspaceSecurityError('No active workspace roots configured', 'OUTSIDE_WORKSPACE', untrustedPath);
  }

  // Normalize path separators to current platform
  const normalizedInput = untrustedPath.trim();

  // Try matching against any of the workspace roots
  for (const root of workspaceRoots) {
    const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root);
    const normalizedRoot = path.resolve(root);
    let resolvedTarget: string;

    if (path.isAbsolute(normalizedInput)) {
      resolvedTarget = path.resolve(normalizedInput);
    } else {
      resolvedTarget = path.resolve(normalizedRoot, normalizedInput);
    }

    // Verify containment: target must be inside root or equal root
    const relative = path.relative(normalizedRoot, resolvedTarget);
    const isContained =
      relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));

    if (!isContained) {
      continue; // Check next root if multi-root
    }

    // Check for symlink escapes if the path exists
    if (fs.existsSync(resolvedTarget)) {
      try {
        const realTargetPath = fs.realpathSync(resolvedTarget);
        const realRelative = path.relative(realRoot, realTargetPath);
        const isRealContained =
          realRelative === '' || (!realRelative.startsWith('..') && !path.isAbsolute(realRelative));

        if (!isRealContained) {
          throw new WorkspaceSecurityError(
            'Target path resolves to a symlink outside the workspace boundary',
            'SYMLINK_ESCAPE',
            untrustedPath,
          );
        }
      } catch (err) {
        if (err instanceof WorkspaceSecurityError) throw err;
        // If permission error reading realpath, reject
        throw new WorkspaceSecurityError(
          'Failed to verify canonical filesystem target',
          'INVALID_PATH',
          untrustedPath,
        );
      }
    } else {
      // If path doesn't exist yet (e.g. creating file), check nearest existing ancestor
      let ancestor = path.dirname(resolvedTarget);
      while (ancestor && ancestor !== path.dirname(ancestor)) {
        if (fs.existsSync(ancestor)) {
          try {
            const realAncestor = fs.realpathSync(ancestor);
            const ancestorRelative = path.relative(realRoot, realAncestor);
            const isAncestorContained =
              ancestorRelative === '' || (!ancestorRelative.startsWith('..') && !path.isAbsolute(ancestorRelative));

            if (!isAncestorContained) {
              throw new WorkspaceSecurityError(
                'Parent directory resolves to a symlink outside the workspace boundary',
                'SYMLINK_ESCAPE',
                untrustedPath,
              );
            }
          } catch (err) {
            if (err instanceof WorkspaceSecurityError) throw err;
          }
          break;
        }
        ancestor = path.dirname(ancestor);
      }
    }

    return resolvedTarget;
  }

  // If no root contained the resolved target, it is an escape attempt
  throw new WorkspaceSecurityError(
    'Requested path escapes the workspace root boundary',
    'PATH_TRAVERSAL_DETECTED',
    untrustedPath,
  );
}
