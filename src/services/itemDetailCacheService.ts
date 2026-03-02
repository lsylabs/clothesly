import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Database } from '../types/database';

type ItemRow = Database['public']['Tables']['clothing_items']['Row'];
type ItemImageRow = Database['public']['Tables']['clothing_item_images']['Row'];

export type ItemDetailCacheEntry = {
  item: ItemRow;
  extraImages: ItemImageRow[];
  selectedClosetNames: string[];
  primaryImageUrl: string | null;
  cachedAt: number;
};

const KEY_PREFIX = 'clothesly:item-detail:v1:';
const memoryCache = new Map<string, ItemDetailCacheEntry>();

const keyFor = (itemId: string) => `${KEY_PREFIX}${itemId}`;

export function getCachedItemDetailSync(itemId: string) {
  return memoryCache.get(itemId) ?? null;
}

export async function getCachedItemDetail(itemId: string) {
  const fromMemory = getCachedItemDetailSync(itemId);
  if (fromMemory) return fromMemory;

  try {
    const raw = await AsyncStorage.getItem(keyFor(itemId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ItemDetailCacheEntry;
    memoryCache.set(itemId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedItemDetail(itemId: string, entry: ItemDetailCacheEntry) {
  memoryCache.set(itemId, entry);
  await AsyncStorage.setItem(keyFor(itemId), JSON.stringify(entry)).catch(() => undefined);
}

export async function clearCachedItemDetail(itemId: string) {
  memoryCache.delete(itemId);
  await AsyncStorage.removeItem(keyFor(itemId)).catch(() => undefined);
}
