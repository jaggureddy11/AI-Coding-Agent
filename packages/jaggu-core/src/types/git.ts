export type GitFileWorkingTreeStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'clean';
export type GitFileIndexStatus = 'modified' | 'added' | 'deleted' | 'clean';

export interface GitFileState {
  relativePath: string;
  isStaged: boolean;
  isModified: boolean;
  isUntracked: boolean;
  isDeleted: boolean;
  preExistingSha256?: string; // SHA-256 hash of file content at task start
}

export interface TaskGitBaseline {
  taskId: string;
  branch: string;
  headCommit: string;
  dirtyFiles: Record<string, GitFileState>;
  capturedAt: number;
}

export interface TaskGitDiffSummary {
  preExistingModifiedFiles: string[];
  jagguModifiedFiles: string[];
  cleanFiles: string[];
  suggestedCommitMessage?: string;
}
