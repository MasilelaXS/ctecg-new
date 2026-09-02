import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'account-resource:v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  savedAt: string;
  data: T;
}

const keyFor = (accountScope: string, resource: string) =>
  `${CACHE_PREFIX}:${encodeURIComponent(accountScope.trim().toUpperCase())}:${resource}`;

export interface CachedResource<T> {
  data: T;
  savedAt: string;
}

export const accountCache = {
  async get<T>(accountScope: string, resource: string): Promise<CachedResource<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(accountScope, resource));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEnvelope<T>;
      const savedAtMs = Date.parse(parsed.savedAt);
      if (!parsed.data || !Number.isFinite(savedAtMs) || Date.now() - savedAtMs > MAX_AGE_MS) {
        await AsyncStorage.removeItem(keyFor(accountScope, resource));
        return null;
      }
      return { data: parsed.data, savedAt: parsed.savedAt };
    } catch {
      return null;
    }
  },

  async set<T>(accountScope: string, resource: string, data: T): Promise<string> {
    const savedAt = new Date().toISOString();
    await AsyncStorage.setItem(keyFor(accountScope, resource), JSON.stringify({ savedAt, data }));
    return savedAt;
  },

  async clearAll(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const matching = keys.filter((key) => key.startsWith(`${CACHE_PREFIX}:`));
    if (matching.length > 0) await AsyncStorage.multiRemove(matching);
  },
};
