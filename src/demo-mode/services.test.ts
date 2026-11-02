import { createHash } from 'node:crypto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { ugnot } from '@/chain/api';
import { parsePoolKey } from '@/chain/realms';
import { isPlayBlocked, sendPresence } from '@/offchain/presence';
import { fastCrypto, until } from '@/offchain/sync/testing';
import { DEFAULT_GRANT } from '@/session/types';
import type { Services } from '@/state/app-services';
import { decodeAddress } from '@/utils/bech32';

import { DEMO_COUNTRY, DEMO_MASTER, DEMO_NAME, DEMO_PAIR_CODE, GUIDED_POOL_KEY } from './constants';
import { memoryKV, memorySecrets } from './memory';
import { createDemoServices } from './services';
import { sha256Hex } from './sha256';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const GNOT = 1_000_000;
const realFetch = global.fetch;
let fetchMock: jest.Mock;
const live: Services[] = [];

beforeEach(() => {
  fetchMock = jest.fn(async () => {
    throw new Error('no network in demo');
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(async () => {
  for (const s of live.splice(0)) {
    s.chat.getState().stop();
    s.rooms.getState().pause();
    s.sync.getState().pause();
    s.session.getState().pause();
  }
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

const settled = (s: Services) =>
  new Promise<void>((resolve) => {
    if (s.session.ready.hasHydrated()) return resolve();
    const off = s.session.ready.onFinishHydration(() => {
      off();
      resolve();
    });
  });

async function demo() {
  const s = createDemoServices({ crypto: fastCrypto });
  live.push(s);
  await settled(s);
  await Promise.all([s.chat.ready, s.identity.ready, s.homeChannels.ready, s.chatChannel.ready]);
  return s;
}

/** the guide's actions, in its order; each must succeed */
async function guide(s: Services) {
  // post, then react to it
  expect(await s.chat.getState().send('hello from the demo')).toBe(true);
  const mine = s.chat.getState().lines.find((l) => l.body === 'hello from the demo');
  expect(mine).toBeDefined();
  await s.chat.getState().react(mine!.id, '🔥');
  expect(s.chat.getState().error).toBe('');
  expect(s.chat.getState().myReactions[mine!.id]).toContain('🔥');

  // pair with the fake browser
  const key = await s.sync.getState().open(DEMO_PAIR_CODE);
  expect(key).not.toBeNull();
  await s.sync.getState().use(key!);
  await until(() => s.sync.getState().paired);
  await until(() => s.identity.getState().identity.reservedName === DEMO_NAME);

  // boop the guided pool, end it, claim, withdraw
  await s.session.getState().restore();
  const session = s.session.getState().active!;
  expect(session).toBeDefined();
  const { version, id } = parsePoolKey(GUIDED_POOL_KEY)!;
  const pool = await s.game.pool(version, id);
  await s.game.bid(session, pool, { ref: '', flag: DEMO_COUNTRY, boost: 1, shot: 0 });
  expect((await s.game.pool(version, id)).lastBidder).toBe(DEMO_MASTER);
  s.demo!.endNow(GUIDED_POOL_KEY);
  const over = await s.game.pool(version, id);
  expect(over.over).toBe(true);
  await s.game.claim(session, over);
  expect((await s.game.me(version, DEMO_MASTER))!.owed).toBeGreaterThan(0);
  await s.game.withdraw(session, version);
  expect((await s.game.me(version, DEMO_MASTER))!.owed).toBe(0);

  // a new session: the simulated computer approves it, the old one is revoked
  await s.session.getState().begin('replace', DEFAULT_GRANT);
  expect(s.session.getState().pending?.op).toBe('replace');
  await s.demo!.approvePending();
  const after = s.session.getState();
  expect(after.phase).toBe('active');
  expect(after.pending).toBeUndefined();
  expect(after.active!.address).not.toBe(session.address);
  expect(after.previous).toBeUndefined();
  await expect(s.api.querySessionAccount(decodeAddress(DEMO_MASTER), decodeAddress(session.address))).rejects.toThrow();
}

test('demo starts with an active session and a balance', async () => {
  const s = await demo();
  expect(s.session.getState().phase).toBe('active');
  expect(s.session.getState().active?.master).toBe(DEMO_MASTER);
  expect(s.net.current()).toEqual({ chainId: 'gnoland-1', remote: 'demo://chain' });
  const acc = await s.api.queryAccount(decodeAddress(DEMO_MASTER));
  expect(ugnot(acc.accountInfo?.coins)).toBe(100 * GNOT);
  expect(s.demo?.pairCode).toBe(DEMO_PAIR_CODE);
  // the restore AppServices runs on launch finds the seeded key unlocked and granted
  await s.session.getState().restore();
  expect(s.session.getState().phase).toBe('active');
  expect(s.session.getState().status?.spendLimit).toBe(100 * GNOT);
});

test("the guide's actions send nothing over the network", async () => {
  const s = await demo();
  await guide(s);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('the demo writes nothing to the phone', async () => {
  const setItem = jest.spyOn(AsyncStorage, 'setItem');
  const s = await demo();
  await guide(s);
  await s.session.getState().revoke();
  await s.demo!.approvePending();
  expect(s.session.getState().phase).toBe('none');
  expect(setItem).not.toHaveBeenCalled();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('presence in demo says FR, so play is open', async () => {
  const s = await demo();
  const r = await sendPresence(s.offchain, 'p');
  expect(r.you).toBe(DEMO_COUNTRY);
  expect(isPlayBlocked(r.you)).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('demo services survive background/foreground without network', async () => {
  const s = await demo();
  const start = () => {
    s.chat.getState().start();
    s.rooms.getState().resume();
    s.sync.getState().resume();
  };
  const stop = () => {
    s.chat.getState().stop();
    s.rooms.getState().pause();
    s.sync.getState().pause();
  };
  start();
  await until(() => s.chat.getState().phase === 'live');
  stop();
  start(); // resumes from its cursor: a long poll that ends when a line arrives
  const line = await s.chatClient.post('mika', 'back in the foreground');
  await until(() => s.chat.getState().lines.some((l) => l.id === line.id));
  stop();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('the avatar of an unknown id is empty; a new demo starts a new world', async () => {
  const a = await demo();
  const b = await demo();
  expect(a.avatarUri('nope')).toBe('');
  expect(await a.chat.getState().send('only in a')).toBe(true);
  const r = await b.chatClient.poll(
    { since: 0, wait: 0, limit: 80, gen: null, name: '' }, { timeoutMs: 1000, signal: new AbortController().signal },
  );
  expect(r.msgs.map((l) => l.body)).not.toContain('only in a');
});

test('memory stores keep values in their map', async () => {
  const kv = memoryKV();
  await kv.setItem('a', '1');
  expect(await kv.getItem('a')).toBe('1');
  expect(kv.map.get('a')).toBe('1');
  await kv.removeItem('a');
  expect(await kv.getItem('a')).toBeNull();
  const sec = memorySecrets();
  await sec.set('b', '2');
  expect(await sec.get('b')).toBe('2');
  expect(sec.map.get('b')).toBe('2');
});

test('sha256Hex is SHA-256', () => {
  for (const s of ['', 'abc', 'aaaaaaaaaaaaaaaa', 'é🫧'.repeat(40)])
    expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
});
