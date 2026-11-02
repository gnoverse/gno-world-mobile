import { ugnot } from '@/chain/api';
import { GameClient } from '@/chain/game-client';
import { SESSION_ALLOW_PATHS } from '@/chain/realms';
import { price } from '@/game/pricing';
import { querySession } from '@/session/status';
import type { ActiveSession } from '@/session/types';
import { unlockKey, type SecretStore } from '@/session/keys';
import { decodeAddress, encodeAddress } from '@/utils/bech32';

import { DEMO_MASTER, GUIDED_POOL_KEY } from '../constants';
import { DemoChain } from './demo-chain';
import { RealmSim } from './realm-sim';

const START = 100_000_000;

function setup() {
  let t = 1_800_000_000;
  const now = () => t;
  const sim = new RealmSim(now);
  const chain = new DemoChain(sim, { now, startBalance: START });
  const game = new GameClient(chain, () => 'demo');
  const key = chain.seedSessionKey('br-session-demo', 'pw');
  const session: ActiveSession = { keyName: 'br-session-demo', ...key, master: DEMO_MASTER, chainId: 'demo' };
  const balance = async () => ugnot((await chain.queryAccount(decodeAddress(DEMO_MASTER))).accountInfo?.coins);
  return { sim, chain, game, session, balance, advance: (s: number) => { t += s; } };
}

test('allPools lists the demo pools and no failed version', async () => {
  const { game } = setup();
  const r = await game.allPools();
  expect(r.failed).toEqual([]);
  expect(r.pools.map((p) => p.key)).toContain(GUIDED_POOL_KEY);
  expect(r.pools.filter((p) => !p.over)).toHaveLength(3);
  expect(r.pools.filter((p) => p.over)).toHaveLength(2);
  expect(r.realms[6]?.shotsOn).toBe(false);
});

test('a boop moves price, pot and top booper', async () => {
  const { game, session, balance } = setup();
  const pool = await game.pool(6, 3);
  const before = await balance();
  await game.bid(session, pool, { ref: '', flag: 'FR', boost: 1, shot: 0 });
  const after = await game.pool(6, 3);
  expect(after.bids).toBe(pool.bids + 1);
  expect(after.lastBidder).toBe(DEMO_MASTER);
  expect(after.nextPrice).toBe(price(after.basePrice, after.bids));
  expect(after.pot).toBeGreaterThan(pool.pot);
  expect(await balance()).toBe(before - pool.nextPrice);
});

test('end now, claim, withdraw pays the winner', async () => {
  const { game, sim, session, balance } = setup();
  const pool = await game.pool(6, 3);
  await game.bid(session, pool, { ref: '', flag: 'FR', boost: 1, shot: 0 });
  sim.endNow(3);
  const over = await game.pool(6, 3);
  expect(over.over).toBe(true);
  await game.claim(session, over);
  const me = await game.me(6, DEMO_MASTER);
  expect(me!.owed).toBeGreaterThan(0);
  const before = await balance();
  await game.withdraw(session, 6);
  expect(await balance()).toBe(before + me!.owed);
  expect((await game.me(6, DEMO_MASTER))!.owed).toBe(0);
});

test('a refused rule throws like the chain', async () => {
  const { game, sim, session } = setup();
  const pool = await game.pool(6, 3);
  sim.endNow(3);
  await expect(game.bid(session, pool, { ref: '', flag: 'FR', boost: 1, shot: 0 })).rejects.toThrow(/pool is over/);
  await expect(game.bid(session, { ...pool, id: 1, version: 6, nextPrice: 1 }, { ref: '', flag: 'FR', boost: 1, shot: 0 }))
    .rejects.toThrow(/price is/);
});

test('create a pool, teams and old realms', async () => {
  const { game, session } = setup();
  await game.createPool(session, { name: 'my pool', window: 600, basePrice: 500_000, seed: 2_000_000 });
  const all = await game.allPools();
  const mine = all.pools.find((p) => p.name === 'my pool')!;
  expect(mine.creator).toBe(DEMO_MASTER);
  expect(mine.pot).toBe(2_000_000);
  expect(all.realms[5]?.pools).toEqual([]);
  expect(Object.keys(await game.teams()).length).toBeGreaterThan(0);
});

test('a session key the computer granted is found; a revoked one is not', async () => {
  const { chain } = setup();
  const created = await chain.createAccount('k2', 'm', 'pw');
  const addr = created!.address;
  const master = decodeAddress(DEMO_MASTER);
  await expect(chain.querySessionAccount(master, addr)).rejects.toThrow(/session not found/);
  chain.grant(encodeAddress(addr));
  const r = await chain.querySessionAccount(master, addr);
  expect(r.accountInfo?.allowPaths).toEqual(SESSION_ALLOW_PATHS);
  chain.revoke(encodeAddress(addr));
  await expect(chain.querySessionAccount(master, addr)).rejects.toThrow(/session not found/);
});

test('the seeded key unlocks with its password and is granted the demo limits', async () => {
  const { chain } = setup();
  const key = chain.seedSessionKey('seeded', 'secret');
  const store: SecretStore = { get: async () => 'secret', set: async () => {} };
  await unlockKey(chain, store, { keyName: 'seeded', ...key }, DEMO_MASTER);
  const st = await querySession(chain, DEMO_MASTER, key.address);
  expect(st!.spendLimit).toBe(100_000_000);
  expect(st!.spendPeriod).toBe(86_400);
  expect(st!.allowPaths).toEqual(SESSION_ALLOW_PATHS);
  await expect(unlockKey(chain, { ...store, get: async () => 'wrong' }, { keyName: 'seeded', ...key }, DEMO_MASTER)).rejects.toThrow();
});
