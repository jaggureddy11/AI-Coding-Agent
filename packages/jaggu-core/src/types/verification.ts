export type VerificationStatus = 'PASS' | 'FAIL' | 'CANCELLED' | 'TIMEOUT' | 'ERROR';

export interface VerificationResult {
  status: VerificationStatus;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  testsPassed?: number;
  testsFailed?: number;
  summary?: string;
}
