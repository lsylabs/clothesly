import type { Database } from '../types/database';
import { listClosets } from './closetService';
import { listItemClosetMappings, listItems } from './itemService';
import { withRetry } from '../utils/retry';

type ClosetRow = Database['public']['Tables']['closets']['Row'];
type ItemRow = Database['public']['Tables']['clothing_items']['Row'];
type MappingRow = Database['public']['Tables']['clothing_item_closets']['Row'];

export type WardrobeData = {
  closets: ClosetRow[];
  items: ItemRow[];
  mappings: MappingRow[];
  loadedAt: number;
};

const cacheByUserId = new Map<string, WardrobeData>();
const inflightByUserId = new Map<string, Promise<WardrobeData>>();

export function getWardrobeDataCache(userId: string) {
  return cacheByUserId.get(userId) ?? null;
}

export function clearWardrobeDataCache(userId: string) {
  cacheByUserId.delete(userId);
  inflightByUserId.delete(userId);
}

export async function fetchWardrobeData(userId: string) {
  const [closets, items, mappings] = await Promise.all([
    withRetry(() => listClosets()),
    withRetry(() => listItems()),
    withRetry(() => listItemClosetMappings())
  ]);

  const data: WardrobeData = {
    closets,
    items,
    mappings,
    loadedAt: Date.now()
  };

  cacheByUserId.set(userId, data);
  return data;
}

export async function prefetchWardrobeData(userId: string) {
  const existing = inflightByUserId.get(userId);
  if (existing) return existing;

  const request = fetchWardrobeData(userId).finally(() => {
    inflightByUserId.delete(userId);
  });
  inflightByUserId.set(userId, request);
  return request;
}

export async function refreshWardrobeData(userId: string) {
  clearWardrobeDataCache(userId);
  return prefetchWardrobeData(userId);
}
