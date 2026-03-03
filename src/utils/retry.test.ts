import { describe, expect, it } from 'vitest';

import { isRetryableError, withRetry } from './retry';

describe('retry utility', () => {
  it('retries transient failures and eventually succeeds', async () => {
    let calls = 0;

    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error('network timeout');
        }
        return 'ok';
      },
      { retries: 3, initialDelayMs: 1 }
    );

    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws after max retries', async () => {
    let calls = 0;

    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('network timeout');
        },
        { retries: 1, initialDelayMs: 1 }
      )
    ).rejects.toThrowError();

    expect(calls).toBe(2);
  });

  it('does not retry non-retryable errors', async () => {
    let calls = 0;

    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('validation failed');
        },
        { retries: 3, initialDelayMs: 1 }
      )
    ).rejects.toThrowError();

    expect(calls).toBe(1);
  });

  it('detects retryable error codes', () => {
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isRetryableError({ code: 'SOME_OTHER_CODE' })).toBe(false);
  });

  it('detects retryable error messages', () => {
    expect(isRetryableError({ message: 'Network request failed' })).toBe(true);
    expect(isRetryableError({ message: 'Operation timed out after 30s' })).toBe(true);
    expect(isRetryableError({ message: 'validation failed' })).toBe(false);
  });

  it('supports custom retryIf behavior', async () => {
    let calls = 0;

    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('validation failed');
        },
        {
          retries: 2,
          initialDelayMs: 1,
          retryIf: () => true
        }
      )
    ).rejects.toThrowError();

    expect(calls).toBe(3);
  });
});
