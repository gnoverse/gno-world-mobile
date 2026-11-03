import { parsePoolKey } from '@/chain/realms';
import { fastCrypto, until } from '@/offchain/sync/testing';
import type { Services } from '@/state/app-services';

import { DEMO_MASTER, DEMO_NAME, GUIDED_POOL_KEY } from '../constants';
import { createDemoServices } from '../services';
import { AUTO_HELLO, doStep } from './do-step';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const live: Services[] = [];
afterEach(() => {
  for (const s of live.splice(0)) {
    s.chat.getState().stop();
    s.rooms.getState().pause();
    s.sync.getState().pause();
    s.session.getState().pause();
  }
});

/** a demo as the app runs it: the session restored, the chat polling */
async function demo() {
  const s = createDemoServices({ crypto: fastCrypto });
  live.push(s);
  await new Promise<void>((resolve) => (s.session.ready.hasHydrated() ? resolve() : s.session.ready.onFinishHydration(() => resolve())));
  await Promise.all([s.chat.ready, s.identity.ready, s.chatChannel.ready]);
  await s.session.getState().restore();
  s.chat.getState().start();
  return s;
}

const { version, id } = parsePoolKey(GUIDED_POOL_KEY)!;
const balance = async (s: Services) => (await s.game.me(version, DEMO_MASTER))!;

test("Next on every step, with nothing done by hand, does each step's action and opens its screen", async () => {
  const s = await demo();
  const go = jest.fn();

  await doStep('chat.sent', s, go);
  expect(go).toHaveBeenLastCalledWith('/chat');
  // the name the app asks for first, then the line
  expect(s.identity.getState().identity.name).toBe(DEMO_NAME);
  expect(s.chat.getState().lines.some((l) => l.body === AUTO_HELLO)).toBe(true);

  await doStep('chat.reacted', s, go);
  expect(Object.values(s.chat.getState().myReactions).flat()).toHaveLength(1);

  await doStep('pair.paired', s, go);
  await until(() => s.sync.getState().paired);
  expect(go).toHaveBeenLastCalledWith('/chat');

  const poolHref = { pathname: '/pool/[key]', params: { key: GUIDED_POOL_KEY } };
  await doStep('pool.opened', s, go);
  expect(go).toHaveBeenLastCalledWith(poolHref);

  await doStep('pool.booped', s, go);
  expect((await s.game.pool(version, id)).lastBidder).toBe(DEMO_MASTER);

  await doStep('pool.ended', s, go);
  expect((await s.game.pool(version, id)).over).toBe(true);

  await doStep('pool.claimed', s, go);
  expect((await s.game.pool(version, id)).paid).toBe(true);
  expect((await balance(s)).owed).toBeGreaterThan(0);

  await doStep('session.withdrew', s, go);
  expect(go).toHaveBeenLastCalledWith('/session');
  expect((await balance(s)).owed).toBe(0);
});

test('a later step does the ones it needs first: withdraw on a fresh demo boops, ends and claims', async () => {
  const s = await demo();
  await doStep('session.withdrew', s, jest.fn());
  const p = await s.game.pool(version, id);
  expect(p).toMatchObject({ over: true, paid: true, lastBidder: DEMO_MASTER });
  const me = await balance(s);
  expect(me.won).toBeGreaterThan(0);
  expect(me.owed).toBe(0);
});

test('an action already done is not done twice', async () => {
  const s = await demo();
  await doStep('pool.booped', s, jest.fn());
  const bids = (await s.game.pool(version, id)).bids;
  await doStep('pool.booped', s, jest.fn());
  expect((await s.game.pool(version, id)).bids).toBe(bids);
});
