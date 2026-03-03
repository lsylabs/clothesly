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

import { clearCachedItemDetail, getCachedItemDetail, getCachedItemDetailSync, setCachedItemDetail } from './itemDetailCacheService';

function sampleEntry() {
  return {
    item: {
      id: 'item-1',
      user_id: 'user-1',
      name: 'Black Tee',
      primary_image_path: 'items/user-1/item-1/primary.jpg',
      brand: null,
      price_amount: null,
      price_currency: 'USD',
      clothing_type: null,
      color: null,
      season: null,
      material: null,
      custom_fields: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    extraImages: [],
    selectedClosetNames: ['Daily'],
    primaryImageUrl: 'https://example.com/image.jpg',
    cachedAt: 123
  };
}

describe('itemDetailCacheService', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it('sets and reads cached item detail from memory sync and async paths', async () => {
    const itemId = 'item-memory-1';
    const entry = sampleEntry();

    await setCachedItemDetail(itemId, entry);

    expect(getCachedItemDetailSync(itemId)).toEqual(entry);
    await expect(getCachedItemDetail(itemId)).resolves.toEqual(entry);
    expect(asyncStorageMock.setItem).toHaveBeenCalledTimes(1);
  });

  it('hydrates from AsyncStorage once and then serves from memory', async () => {
    const itemId = 'item-storage-1';
    const key = `clothesly:item-detail:v1:${itemId}`;
    const entry = sampleEntry();
    storage.set(key, JSON.stringify(entry));

    await expect(getCachedItemDetail(itemId)).resolves.toEqual(entry);
    await expect(getCachedItemDetail(itemId)).resolves.toEqual(entry);
    expect(asyncStorageMock.getItem).toHaveBeenCalledTimes(1);
  });

  it('returns null when persisted JSON cannot be parsed', async () => {
    const itemId = 'item-bad-json-1';
    storage.set(`clothesly:item-detail:v1:${itemId}`, '{bad');

    await expect(getCachedItemDetail(itemId)).resolves.toBeNull();
  });

  it('clears memory and AsyncStorage entries', async () => {
    const itemId = 'item-clear-1';
    const entry = sampleEntry();
    await setCachedItemDetail(itemId, entry);

    await clearCachedItemDetail(itemId);

    expect(getCachedItemDetailSync(itemId)).toBeNull();
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(`clothesly:item-detail:v1:${itemId}`);
  });

  it('swallows AsyncStorage set/remove failures', async () => {
    const itemId = 'item-failure-1';
    const entry = sampleEntry();
    asyncStorageMock.setItem.mockRejectedValueOnce(new Error('set failed'));
    asyncStorageMock.removeItem.mockRejectedValueOnce(new Error('remove failed'));

    await expect(setCachedItemDetail(itemId, entry)).resolves.toBeUndefined();
    await expect(clearCachedItemDetail(itemId)).resolves.toBeUndefined();
  });
});
