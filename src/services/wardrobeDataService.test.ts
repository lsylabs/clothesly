import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listClosets, listItems, listItemClosetMappings, withRetry } = vi.hoisted(() => ({
  listClosets: vi.fn(),
  listItems: vi.fn(),
  listItemClosetMappings: vi.fn(),
  withRetry: vi.fn((fn: () => unknown) => fn())
}));

vi.mock('./closetService', () => ({
  listClosets
}));

vi.mock('./itemService', () => ({
  listItems,
  listItemClosetMappings
}));

vi.mock('../utils/retry', () => ({
  withRetry
}));

import { clearWardrobeDataCache, fetchWardrobeData, getWardrobeDataCache, prefetchWardrobeData, refreshWardrobeData } from './wardrobeDataService';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('wardrobeDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWardrobeDataCache('user-1');
    clearWardrobeDataCache('user-2');
  });

  it('fetches wardrobe data and caches it with loadedAt timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    listClosets.mockResolvedValue([{ id: 'closet-1' }]);
    listItems.mockResolvedValue([{ id: 'item-1' }]);
    listItemClosetMappings.mockResolvedValue([{ item_id: 'item-1', closet_id: 'closet-1' }]);

    const result = await fetchWardrobeData('user-1');

    expect(result).toEqual({
      closets: [{ id: 'closet-1' }],
      items: [{ id: 'item-1' }],
      mappings: [{ item_id: 'item-1', closet_id: 'closet-1' }],
      loadedAt: 12345
    });
    expect(getWardrobeDataCache('user-1')).toEqual(result);
    expect(withRetry).toHaveBeenCalledTimes(3);
  });

  it('dedupes in-flight prefetch requests for the same user', async () => {
    const pendingClosets = deferred<Array<{ id: string }>>();
    listClosets.mockReturnValue(pendingClosets.promise);
    listItems.mockResolvedValue([{ id: 'item-1' }]);
    listItemClosetMappings.mockResolvedValue([]);

    const first = prefetchWardrobeData('user-1');
    const second = prefetchWardrobeData('user-1');

    expect(listClosets).toHaveBeenCalledTimes(1);
    expect(listItems).toHaveBeenCalledTimes(1);
    expect(listItemClosetMappings).toHaveBeenCalledTimes(1);

    pendingClosets.resolve([{ id: 'closet-1' }]);
    await expect(first).resolves.toMatchObject({
      closets: [{ id: 'closet-1' }],
      items: [{ id: 'item-1' }],
      mappings: []
    });
    await expect(second).resolves.toMatchObject({
      closets: [{ id: 'closet-1' }],
      items: [{ id: 'item-1' }],
      mappings: []
    });
  });

  it('clears cache and forces a fresh request on refresh', async () => {
    listClosets.mockResolvedValue([{ id: 'closet-old' }]);
    listItems.mockResolvedValue([{ id: 'item-old' }]);
    listItemClosetMappings.mockResolvedValue([]);
    await prefetchWardrobeData('user-1');
    expect(getWardrobeDataCache('user-1')).toBeTruthy();

    listClosets.mockResolvedValue([{ id: 'closet-new' }]);
    listItems.mockResolvedValue([{ id: 'item-new' }]);
    listItemClosetMappings.mockResolvedValue([{ item_id: 'item-new', closet_id: 'closet-new' }]);
    const refreshed = await refreshWardrobeData('user-1');

    expect(refreshed.closets).toEqual([{ id: 'closet-new' }]);
    expect(refreshed.items).toEqual([{ id: 'item-new' }]);
    expect(refreshed.mappings).toEqual([{ item_id: 'item-new', closet_id: 'closet-new' }]);
  });

  it('supports explicit cache clearing', () => {
    clearWardrobeDataCache('user-2');
    expect(getWardrobeDataCache('user-2')).toBeNull();
  });
});
