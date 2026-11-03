import { createHash, randomBytes } from 'node:crypto';

import { createSyncClient } from '@/offchain/sync/client';
import { createIdentityStore } from '@/offchain/chat/identity';
import { createBookStore } from '@/offchain/sync/rooms';
import { createSyncStore } from '@/offchain/sync/store';
import { fastCrypto, until } from '@/offchain/sync/testing';

import { DEMO_NAME, DEMO_PAIR_CODE } from '../constants';
import { fakeBrowser } from './fake-browser';
import { createOffchainWorld, type OffchainWorld, type WorldSeedApi } from './offchain-world';
import { seedDemoWorld } from './seed';
import { createWorldOffchain } from './world-offchain';

const wcrypto = {
  sha256Hex: (s: string) => createHash('sha256').update(s).digest('hex'),
  randomBytes: (n: number) => new Uint8Array(randomBytes(n)),
};

function build(seed?: (w: WorldSeedApi) => void) {
  let world: OffchainWorld | undefined;
  world = createOffchainWorld({
    crypto: wcrypto, names: 'open', seed,
    pairFallback: (code) => fakeBrowser({ world: world!, crypto: fastCrypto, now: () => Date.now() })(code),
  });
  const secrets = new Map<string, string>();
  const kv = new Map<string, string>();
  const sec = { get: async (k: string) => secrets.get(k) ?? null, set: async (k: string, v: string) => void secrets.set(k, v) };
  const identity = createIdentityStore(sec, () => 'http://demo');
  const book = createBookStore({
    kv: { getItem: async (k) => kv.get(k) ?? null, setItem: async (k, v) => void kv.set(k, v) },
    secrets: sec, crypto: fastCrypto, scope: () => 'http://demo',
  });
  const store = createSyncStore({
    client: createSyncClient(createWorldOffchain(world, 'aaaaaaaaaaaaaaaa')), crypto: fastCrypto, secrets: sec, book, identity,
    identityChanged: () => undefined, scope: () => 'http://demo',
  });
  return { world, store, identity, book };
}

describe('fake browser', () => {
  it('any well-formed code pairs with the fake browser', async () => {
    const a = build(seedDemoWorld);
    const key = await a.store.getState().open(DEMO_PAIR_CODE);
    expect(key).not.toBeNull();
    await a.store.getState().use(key!);
    await until(() => a.store.getState().paired);
    expect((await a.identity.load()).reservedName).toBe(DEMO_NAME);
    expect((await a.book.load()).rooms.map((r) => r.name)).toContain('From my browser');
    a.store.getState().pause();
  });

  it('a malformed code is refused like the real server', async () => {
    const a = build();
    expect(await a.store.getState().open('0O1')).toBeNull();
    expect(a.store.getState().acceptError).toContain('six letters and digits');
    expect(a.world.waiting()).toEqual([]);
    const r = await a.world.handle({ method: 'GET', path: '/api/sync/pair/0O1', headers: {} });
    expect(r.status).toBe(400);
  });

  it('the seed has no production names', async () => {
    const lines: string[] = [];
    seedDemoWorld({
      say: (p) => (lines.push(p.name), 0),
      makeRoom: () => ({ id: 'a'.repeat(20), key: '' }),
      reserve: (name) => ({ name, key: '' }),
      writeRecord: () => undefined,
    });
    expect(lines.length).toBeGreaterThanOrEqual(8);
    for (const n of lines) expect(['mika', 'sol', 'rune']).toContain(n);
  });
});
