export interface Job<T = unknown> {
  id: string;
  payload: T;
  retryCount: number;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProcessResult<R = unknown> {
  jobId: string;
  status: JobStatus;
  result?: R;
  error?: string;
}

export interface BatchProcessingSummary<R = unknown> {
  total: number;
  completed: number;
  failed: number;
  results: ProcessResult<R>[];
}
