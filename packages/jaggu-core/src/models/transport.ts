import { ModelError, ModelErrorCode } from '../types/models.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

/**
 * Parses HTTP status code into standard ModelError with retry classification.
 */
export function classifyHttpStatus(status: number, providerId: string, statusText: string, bodyText?: string): ModelError {
  let code: ModelErrorCode;
  let retryable = false;

  if (status === 401 || status === 403) {
    code = 'AUTH_FAILURE';
    retryable = false;
  } else if (status === 429) {
    code = 'RATE_LIMIT';
    retryable = true;
  } else if (status === 408 || status === 504) {
    code = 'TIMEOUT';
    retryable = true;
  } else if (status >= 500) {
    code = 'SERVER_ERROR';
    retryable = true;
  } else if (status === 400 && bodyText?.toLowerCase().includes('context_length')) {
    code = 'CONTEXT_LENGTH_EXCEEDED';
    retryable = false;
  } else if (status === 404) {
    code = 'MODEL_NOT_FOUND';
    retryable = false;
  } else if (status >= 400 && status < 500) {
    code = 'MALFORMED_RESPONSE';
    retryable = false;
  } else {
    code = 'UNKNOWN';
  }

  const detail = bodyText ? `: ${bodyText.slice(0, 300)}` : '';
  return new ModelError(
    `[${providerId}] HTTP ${status} ${statusText}${detail}`,
    code,
    providerId,
    status,
    retryable,
  );
}

/**
 * Resilient HTTP client with native fetch, exponential backoff, and cancellation support.
 */
export async function resilientFetch(
  url: string,
  init: RequestInit,
  providerId: string,
  retryOptions: RetryOptions = {},
): Promise<Response> {
  const options = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  let attempt = 0;

  while (true) {
    if (init.signal?.aborted) {
      throw new ModelError('Request was cancelled by user', 'CANCELLED', providerId, undefined, false);
    }

    try {
      const response = await fetch(url, init);

      if (response.ok) {
        return response;
      }

      const bodyText = await response.text().catch(() => '');
      const err = classifyHttpStatus(response.status, providerId, response.statusText, bodyText);

      if (err.retryable && attempt < options.maxRetries) {
        attempt++;
        const backoff = Math.min(
          options.baseDelayMs * Math.pow(2, attempt) + Math.random() * 150,
          options.maxDelayMs,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      throw err;
    } catch (error: unknown) {
      if (error instanceof ModelError) {
        throw error;
      }

      if (init.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new ModelError('Request was cancelled by user', 'CANCELLED', providerId, undefined, false);
      }

      // Network failures (e.g. ECONNREFUSED, fetch failed)
      if (attempt < options.maxRetries) {
        attempt++;
        const backoff = Math.min(
          options.baseDelayMs * Math.pow(2, attempt) + Math.random() * 150,
          options.maxDelayMs,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      const msg = error instanceof Error ? error.message : String(error);
      throw new ModelError(
        `[${providerId}] Network connection failed: ${msg}`,
        'NETWORK_ERROR',
        providerId,
        undefined,
        true,
      );
    }
  }
}

/**
 * Converts a Response ReadableStream into an async generator of Server-Sent Event (SSE) lines.
 */
export async function* parseSseStream(response: Response, abortSignal?: AbortSignal): AsyncGenerator<string> {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (abortSignal?.aborted) {
        await reader.cancel().catch(() => {});
        throw new ModelError('Request was cancelled by user', 'CANCELLED', 'transport', undefined, false);
      }

      let readResult: Awaited<ReturnType<typeof reader.read>>;
      try {
        readResult = await reader.read();
      } catch (err: unknown) {
        if (abortSignal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
          throw new ModelError('Request was cancelled by user', 'CANCELLED', 'transport', undefined, false);
        }
        throw err;
      }

      const { done, value } = readResult;
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) {
          continue; // Keep-alive comment or empty line
        }
        if (trimmed.startsWith('data:')) {
          yield trimmed.slice(5).trim();
        }
      }
    }

    if (buffer.trim().startsWith('data:')) {
      yield buffer.trim().slice(5).trim();
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Converts a Response ReadableStream into an async generator of NDJSON objects.
 */
export async function* parseNdjsonStream<T = unknown>(response: Response, abortSignal?: AbortSignal): AsyncGenerator<T> {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (abortSignal?.aborted) {
        await reader.cancel().catch(() => {});
        throw new ModelError('Request was cancelled by user', 'CANCELLED', 'transport', undefined, false);
      }

      let readResult: Awaited<ReturnType<typeof reader.read>>;
      try {
        readResult = await reader.read();
      } catch (err: unknown) {
        if (abortSignal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
          throw new ModelError('Request was cancelled by user', 'CANCELLED', 'transport', undefined, false);
        }
        throw err;
      }

      const { done, value } = readResult;
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            yield JSON.parse(trimmed) as T;
          } catch {
            // skip malformed line
          }
        }
      }
    }

    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer.trim()) as T;
      } catch {
        // ignore
      }
    }
  } finally {
    reader.releaseLock();
  }
}
