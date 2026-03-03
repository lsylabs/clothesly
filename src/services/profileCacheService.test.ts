import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storage, asyncStorageMock } = vi.hoisted(() => {
  const localStorage = new Map<string, string>();
  const mock = {
    getItem: vi.fn(async (key: string) => localStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      localStorage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      localStorage.delete(key);
    })
  };
  return { storage: localStorage, asyncStorageMock: mock };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock
}));

import { clearCachedProfile, getCachedProfile, getCachedProfileSync, setCachedProfile } from './profileCacheService';

function sampleEntry() {
  return {
    displayName: 'Test User',
    email: 'test@example.com',
    avatarPath: 'avatars/user-1/avatar.jpg',
    cachedAt: 123
  };
}

describe('profileCacheService', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it('sets and reads cached profile from memory and async getter', async () => {
    const userId = 'user-memory-1';
    const entry = sampleEntry();

    await setCachedProfile(userId, entry);

    expect(getCachedProfileSync(userId)).toEqual(entry);
    await expect(getCachedProfile(userId)).resolves.toEqual(entry);
    expect(asyncStorageMock.setItem).toHaveBeenCalledTimes(1);
  });

  it('hydrates from AsyncStorage once and reuses memory cache', async () => {
    const userId = 'user-storage-1';
    const key = `clothesly:profile:v1:${userId}`;
    const entry = sampleEntry();
    storage.set(key, JSON.stringify(entry));

    await expect(getCachedProfile(userId)).resolves.toEqual(entry);
    await expect(getCachedProfile(userId)).resolves.toEqual(entry);
    expect(asyncStorageMock.getItem).toHaveBeenCalledTimes(1);
  });

  it('returns null on invalid persisted JSON', async () => {
    const userId = 'user-bad-json-1';
    storage.set(`clothesly:profile:v1:${userId}`, '{not-json');

    await expect(getCachedProfile(userId)).resolves.toBeNull();
  });

  it('clears profile cache in memory and storage', async () => {
    const userId = 'user-clear-1';
    const entry = sampleEntry();
    await setCachedProfile(userId, entry);

    await clearCachedProfile(userId);

    expect(getCachedProfileSync(userId)).toBeNull();
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(`clothesly:profile:v1:${userId}`);
  });

  it('swallows AsyncStorage set/remove failures', async () => {
    const userId = 'user-failure-1';
    const entry = sampleEntry();
    asyncStorageMock.setItem.mockRejectedValueOnce(new Error('set failed'));
    asyncStorageMock.removeItem.mockRejectedValueOnce(new Error('remove failed'));

    await expect(setCachedProfile(userId, entry)).resolves.toBeUndefined();
    await expect(clearCachedProfile(userId)).resolves.toBeUndefined();
  });
});
