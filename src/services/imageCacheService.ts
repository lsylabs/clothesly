import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { createSignedImageUrl } from './mediaService';

type Bucket = 'avatars' | 'closets' | 'items';

type CacheEntry = {
  uri: string;
  expiresAt: number;
  local: boolean;
};

const SIGNED_URL_TTL_SECONDS = 60 * 10;
const REFRESH_BUFFER_MS = 45 * 1000;
const CACHE_INDEX_KEY = 'clothesly:image-cache:v1';
const CACHE_DIR = `${FileSystem.cacheDirectory ?? ''}clothesly-image-cache/`;
const cache = new Map<string, CacheEntry>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

const keyFor = (bucket: Bucket, path: string) => `${bucket}:${path}`;
const hashKey = (input: string) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const filePathFor = (bucket: Bucket, path: string) => `${CACHE_DIR}${hashKey(`${bucket}:${path}`)}.img`;

async function ensureHydrated() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
          Object.entries(parsed).forEach(([key, value]) => {
            if (!value?.uri) return;
            cache.set(key, value);
          });
        }
      } catch {
        // Ignore cache hydration errors.
      } finally {
        hydrated = true;
      }
    })();
  }
  await hydratePromise;
}

async function persistCacheIndex() {
  const payload = Object.fromEntries(cache.entries());
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(payload));
}

export function getCachedSignedImageUrlSync(bucket: Bucket, path: string) {
  const cleanPath = path.trim();
  if (!cleanPath || cleanPath === 'pending') return null;

  const key = keyFor(bucket, cleanPath);
  const entry = cache.get(key);
  if (!entry) return null;
  if (!entry.local && entry.expiresAt - REFRESH_BUFFER_MS <= Date.now()) return null;
  return entry.uri;
}

export async function getCachedSignedImageUrl(bucket: Bucket, path: string) {
  const cleanPath = path.trim();
  if (!cleanPath || cleanPath === 'pending') return null;
  await ensureHydrated();

  const key = keyFor(bucket, cleanPath);
  const cached = cache.get(key);
  if (cached) {
    if (cached.local) {
      const info = await FileSystem.getInfoAsync(cached.uri);
      if (info.exists) return cached.uri;
      cache.delete(key);
      await persistCacheIndex().catch(() => undefined);
    } else if (cached.expiresAt - REFRESH_BUFFER_MS > Date.now()) {
      return cached.uri;
    }
  }

  const signedUrl = await createSignedImageUrl(bucket, cleanPath, SIGNED_URL_TTL_SECONDS);
  if (!signedUrl) return null;

  if (CACHE_DIR) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }

      const localPath = filePathFor(bucket, cleanPath);
      const download = await FileSystem.downloadAsync(signedUrl, localPath);
      cache.set(key, {
        uri: download.uri,
        expiresAt: Number.MAX_SAFE_INTEGER,
        local: true
      });
      await persistCacheIndex().catch(() => undefined);
      return download.uri;
    } catch {
      // Fall back to signed remote URL if local write fails.
    }
  }

  cache.set(key, {
    uri: signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    local: false
  });
  await persistCacheIndex().catch(() => undefined);
  Image.prefetch(signedUrl).catch(() => undefined);
  return signedUrl;
}

export async function warmSignedImageUrls(bucket: Bucket, paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
  await Promise.all(uniquePaths.map((path) => getCachedSignedImageUrl(bucket, path).catch(() => null)));
}
