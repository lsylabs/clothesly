import AsyncStorage from '@react-native-async-storage/async-storage';

type ProfileCacheEntry = {
  displayName: string;
  email: string;
  avatarPath: string | null;
  cachedAt: number;
};

const KEY_PREFIX = 'clothesly:profile:v1:';
const memoryCache = new Map<string, ProfileCacheEntry>();

const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;

export function getCachedProfileSync(userId: string) {
  return memoryCache.get(userId) ?? null;
}

export async function getCachedProfile(userId: string) {
  const fromMemory = getCachedProfileSync(userId);
  if (fromMemory) return fromMemory;

  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileCacheEntry;
    memoryCache.set(userId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedProfile(userId: string, entry: ProfileCacheEntry) {
  memoryCache.set(userId, entry);
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(entry)).catch(() => undefined);
}

export async function clearCachedProfile(userId: string) {
  memoryCache.delete(userId);
  await AsyncStorage.removeItem(keyFor(userId)).catch(() => undefined);
}
