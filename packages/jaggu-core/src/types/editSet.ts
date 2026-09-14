export type EditSetStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CONFLICT';

export interface ProposedFileEdit {
  relativePath: string;
  absolutePath: string;
  originalContent: string;
  proposedContent: string;
  baseContentHash: string;
  isNewFile: boolean;
  shadowUri: string;
}

export interface EditSet {
  id: string;
  planId?: string;
  files: ProposedFileEdit[];
  status: EditSetStatus;
  createdAt: number;
}

export interface EditSetApplyResult {
  success: boolean;
  editSetId: string;
  appliedFiles: string[];
  failedFile?: string;
  error?: string;
  rolledBack?: boolean;
}
