export type EditSetStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CONFLICT';
export type EditFileStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CONFLICT';

export interface ProposedFileEdit {
  relativePath: string;
  absolutePath: string;
  originalContent: string;
  proposedContent: string;
  baseContentHash: string;
  isNewFile: boolean;
  shadowUri: string;
  status?: EditFileStatus;
}

export interface EditSet {
  id: string;
  planId?: string;
  files: ProposedFileEdit[];
  status: EditSetStatus;
  createdAt: number;
}

export interface EditApprovalDecision {
  approved: boolean;
  approvedFiles?: string[];
  rejectedFiles?: string[];
}

export interface EditSetApplyResult {
  success: boolean;
  editSetId: string;
  appliedFiles: string[];
  rejectedFiles?: string[];
  failedFile?: string;
  error?: string;
  rolledBack?: boolean;
}
