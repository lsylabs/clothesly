export type RetryOptions = {
  retries?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  retryIf?: (error: unknown) => boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isRetryableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; message?: string };

  if (typeof maybe.code === 'string') {
    return ['ETIMEDOUT', 'ECONNRESET', 'NETWORK_ERROR', '503', '504'].includes(maybe.code);
  }

  if (typeof maybe.message === 'string') {
    const text = maybe.message.toLowerCase();
    return text.includes('network') || text.includes('timed out') || text.includes('timeout');
  }

  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}) {
  const retries = options.retries ?? 2;
  const initialDelayMs = options.initialDelayMs ?? 300;
  const backoffMultiplier = options.backoffMultiplier ?? 2;
  const retryIf = options.retryIf ?? isRetryableError;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !retryIf(error)) {
        throw error;
      }
      await sleep(delay);
      delay *= backoffMultiplier;
      attempt += 1;
    }
  }
}

