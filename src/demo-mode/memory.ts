import type { KV } from '@/offchain/chat/store';
import type { SecretStore } from '@/session/keys';

/** AsyncStorage's place in demo mode: a Map, gone with the demo. Also a StateStorage (zustand persist). */
export function memoryKV(): KV & { removeItem(k: string): Promise<void>; map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

/** The secure store's place in demo mode: a Map, gone with the demo. */
export function memorySecrets(): SecretStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => void map.set(k, v),
  };
}
