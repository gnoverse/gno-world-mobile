import { sealJson, sealSyncKey, syncId, type CryptoBackend } from '@/offchain/sync/crypto';
import type { RoomEntry } from '@/offchain/sync/rooms';

import { DEMO_MASTER, DEMO_NAME } from '../constants';

import type { OffchainWorld } from './offchain-world';

/**
 * The browser a demo user "pairs" with: for any well-formed code it makes a sync key, a name and a room, stores
 * what a real browser would have synced, and hands back the key sealed with the code.
 */
export function fakeBrowser(d: { world: OffchainWorld; crypto: CryptoBackend; now: () => number }) {
  return async (code: string): Promise<string | null> => {
    const key = d.crypto.random(32);
    const name = d.world.reserve(DEMO_NAME, DEMO_MASTER);
    const room = d.world.makeRoom('From my browser', false);
    d.world.say({ name: DEMO_NAME, body: 'hello from my browser', room: room.id });
    d.world.say({ name: DEMO_NAME, body: 'the app can read this room too', room: room.id });
    const at = d.now();
    const entry: RoomEntry = { id: room.id, name: 'From my browser', key: room.key, at };
    d.world.writeRecord(
      await syncId(d.crypto, key),
      await sealJson(d.crypto, key, { rooms: [entry], left: {}, name: { name: name.name, key: name.key }, at }),
    );
    return sealSyncKey(d.crypto, code, key);
  };
}
