import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'ht:cache:';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================
// Types
// ============================================================

type CacheEntry<T> = {
  data: T;
  cachedAt: number;
  ttlMs: number;
};

// ============================================================
// Core read / write
// ============================================================

/** Persist data under `key` with an optional TTL (defaults to 5 min). */
export async function setCached<T>(
  key: string,
  data: T,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const entry: CacheEntry<T> = { data, cachedAt: Date.now(), ttlMs };
  await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
}

/**
 * Retrieve cached data.
 * Returns null when missing or expired (and cleans up the stale entry).
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      await AsyncStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/** Check whether a key has a valid (non-expired) cache entry. */
export async function isCached(key: string): Promise<boolean> {
  return (await getCached(key)) !== null;
}

/** Remove one or more cache entries by key. */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  await Promise.all(keys.map((k) => AsyncStorage.removeItem(PREFIX + k)));
}

/** Wipe every cache entry written by this module. */
export async function clearAllCache(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const cacheKeys = (allKeys as readonly string[]).filter((k) => k.startsWith(PREFIX));
  await Promise.all(cacheKeys.map((k) => AsyncStorage.removeItem(k)));
}

// ============================================================
// Predefined cache keys
// ============================================================

export const CACHE_KEYS = {
  habits: 'habits',
  completions: (habitId: string) => `completions:${habitId}`,
} as const;

// ============================================================
// TTL constants (export so callers can stay consistent)
// ============================================================

export const TTL = {
  SHORT: 60 * 1000,           //  1 min  — frequently changing data
  MEDIUM: 5 * 60 * 1000,      //  5 min  — habits list
  LONG: 15 * 60 * 1000,       // 15 min  — completion history
} as const;
