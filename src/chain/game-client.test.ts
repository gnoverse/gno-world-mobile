import { readFileSync } from 'fs';
import { join } from 'path';

import type { QEvalJSONValuesResponse } from '@gnolang/gnonative';

import { FakeChainApi } from '@/chain/fake-api';
import { GameClient } from '@/chain/game-client';
import { parsePool, poolValueExpr } from '@/chain/parse';
import { REALMS, type Version } from '@/chain/realms';
import type { ActiveSession } from '@/session/types';
import { bytesToHex, decodeAddress } from '@/utils/bech32';

const fx = (n: string) => readFileSync(join(__dirname, '__fixtures__', n), 'utf8');
const session: ActiveSession = {
  keyName: 'br-session-1', address: 'g1jyh59tr2t4yjmwajjax9mye369gkkujv7tegkk',
  pubkey: 'gpub1x', master: 'g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5', chainId: 'gnoland-1',
};

test('allPools merges every version and survives one failing realm', async () => {
  const api = new FakeChainApi();
  api.renders.set(`${REALMS[6]}:json`, fx('v6-realm.json'));
  api.renders.set(`${REALMS[5]}:json`, fx('v5-realm.json'));
  api.renders.set(`${REALMS[1]}:json`, fx('v1-realm.json'));
  const g = new GameClient(api, () => 'gnoland-1');
  const r = await g.allPools();
  expect(r.pools.map((p) => p.key)).toEqual(['v6-1', 'v6-2', 'v5-1', 'v5-2', 'v5-99', 'v1-6']);
  expect(r.failed.sort()).toEqual([2, 3, 4]);
});

test('bid sends price × boost + shot with the right args, gas and signer', async () => {
  const api = new FakeChainApi();
  const g = new GameClient(api, () => 'gnoland-1');
  const pool = parsePool(fx('v5-pool.json'), 5);
  const res = await g.bid(session, pool, { ref: 'g1leu8d2vsplhehcfkjg50mwgdpxdkt8tztu95wr', flag: 'FR', boost: 2, shot: 100000 });
  expect(res).toEqual({ hash: 'abcd', height: 7 });
  const c = api.calls[0];
  expect(c.pkg).toBe(REALMS[5]);
  expect(c.fnc).toBe('Bid');
  expect(c.args).toEqual(['2', 'g1leu8d2vsplhehcfkjg50mwgdpxdkt8tztu95wr', 'FR', '100000']);
  expect(c.send).toEqual([{ denom: 'ugnot', amount: BigInt(2397916 * 2 + 100000) }]);
  expect(c.gasFee).toBe('39600ugnot');
  expect(c.gasWanted).toBe(39600000n);
  expect(c.signerHex).toHaveLength(40);
});

/** qeval_json's Amino JSON for a pool, recorded from gnoland-1 through gnonative's goserver on 2026-10-28 (the pool
 *  is over, so it still matches v<v>-<id>-pool.json), into a FakeChainApi (bigints and bytes revived). It has no
 *  objects: a second query would throw. */
function aminoJSONFixture(api: FakeChainApi, v: Version, id: number) {
  const res = JSON.parse(fx(`v${v}-${id}-pool-aminojson.json`), (k, x) =>
    k === 'offset' || k === 'length' || k === 'index' ? BigInt(x) : k === 'data' ? Uint8Array.from(Object.values(x)) : x,
  ) as QEvalJSONValuesResponse;
  api.evals.set(`${REALMS[v]}:${poolValueExpr(v, id)}`, res);
}

test.each([[3, 65], [6, 38]] as const)('pool reads v%i-%i from the Amino JSON as the Render JSON has it, in one query', async (v, id) => {
  const api = new FakeChainApi();
  aminoJSONFixture(api, v, id);
  const p = await new GameClient(api, () => 'gnoland-1').pool(v, id);
  expect(p).toEqual(parsePool(fx(`v${v}-${id}-pool.json`), v));
  expect(p.shotlog.length).toBeGreaterThan(0);
});

test('teams are read from the current realm', async () => {
  const api = new FakeChainApi();
  api.renders.set(`${REALMS[6]}:teams`, fx('v5-teams.json'));
  await expect(new GameClient(api, () => 'gnoland-1').teams()).resolves.toBeDefined();
});

test('a session from another chain is refused before anything is signed', async () => {
  const api = new FakeChainApi();
  const g = new GameClient(api, () => 'dev');
  const pool = parsePool(fx('v5-pool.json'), 5);
  await expect(g.claim(session, pool)).rejects.toMatchObject({
    kind: 'wrong-chain',
    message: 'Your session is for gnoland-1. Switch back to it in Settings, or get a session for dev from the Session tab.',
  });
  expect(api.calls).toHaveLength(0);
});

test('chain errors are classified', async () => {
  const api = new FakeChainApi();
  api.failNextCall = new Error('session expired: expires_at=1, block_time=2');
  const g = new GameClient(api, () => 'gnoland-1');
  await expect(g.withdraw(session, 5)).rejects.toMatchObject({ kind: 'expired' });
});

// gnonative passes on only "session not allowed error": the cause is read back from the session on chain.
function onChainSession(api: FakeChainApi, allowPaths: string[]) {
  api.sessions.set(`${bytesToHex(decodeAddress(session.master))}/${bytesToHex(decodeAddress(session.address))}`, {
    expiresAt: 0n, spendLimit: [], spendPeriod: 3600n, spendUsed: [], spendReset: 0n, allowPaths,
  });
}

test('a refusal on a realm the session does not cover is not-allowed', async () => {
  const api = new FakeChainApi();
  onChainSession(api, [`vm/exec:${REALMS[5]}`]);
  api.failNextCall = new Error('session not allowed error');
  await expect(new GameClient(api, () => 'gnoland-1').withdraw(session, 6)).rejects.toMatchObject({ kind: 'not-allowed' });
});

test('a refusal on a covered realm stays a budget refusal', async () => {
  const api = new FakeChainApi();
  onChainSession(api, [`vm/exec:${REALMS[6]}`]);
  api.failNextCall = new Error('session not allowed error');
  await expect(new GameClient(api, () => 'gnoland-1').withdraw(session, 6)).rejects.toMatchObject({ kind: 'budget' });
});

test('a refusal stays a budget refusal when the session cannot be read', async () => {
  const api = new FakeChainApi();
  api.failNextCall = new Error('session not allowed error');
  await expect(new GameClient(api, () => 'gnoland-1').withdraw(session, 6)).rejects.toMatchObject({ kind: 'budget' });
});

test('withdraw is refused on versions without Withdraw', async () => {
  const g = new GameClient(new FakeChainApi(), () => 'gnoland-1');
  await expect(g.withdraw(session, 2)).rejects.toThrow(/no Withdraw/);
});

test('createPool sends the seed and the arguments in realm order', async () => {
  const api = new FakeChainApi();
  await new GameClient(api, () => 'gnoland-1').createPool(session, { name: 'x', window: 600, basePrice: 1000, seed: 5000 });
  expect(api.calls[0]).toMatchObject({ pkg: REALMS[6], fnc: 'CreatePool', args: ['x', '600', '1000'] });
  expect(api.calls[0].send).toEqual([{ denom: 'ugnot', amount: 5000n }]);
});

test('every transaction refuses a session from another chain', async () => {
  const api = new FakeChainApi();
  const g = new GameClient(api, () => 'dev');
  const pool = parsePool(fx('v5-pool.json'), 5);
  await expect(g.bid(session, pool, { ref: '', flag: '', boost: 1, shot: 0 })).rejects.toMatchObject({ kind: 'wrong-chain' });
  await expect(g.createPool(session, { name: 'x', window: 600, basePrice: 1000, seed: 0 })).rejects.toMatchObject({ kind: 'wrong-chain' });
  await expect(g.withdraw(session, 5)).rejects.toMatchObject({ kind: 'wrong-chain' });
  expect(api.calls).toHaveLength(0);
});

test.each([1, 6] as const)("a pool the v%i realm does not have is a classified error, not the realm's panic", async (v) => {
  const api = new FakeChainApi();
  api.qEvalJSONValues = async () => {
    throw new Error('[unknown] ErrChainRejected(#155): no such pool'); // as gnonative passes on the panic
  };
  await expect(new GameClient(api, () => 'gnoland-1').pool(v, 9)).rejects.toMatchObject({
    name: 'ChainError', kind: 'other', message: `no pool v${v}-9 on this network`,
  });
});

test('other errors reading a pool pass through', async () => {
  const e = new Error('network request failed');
  const api = new FakeChainApi();
  api.qEvalJSONValues = async () => {
    throw e;
  };
  await expect(new GameClient(api, () => 'gnoland-1').pool(6, 9)).rejects.toBe(e);
});

test('a transaction whose stream ends without a result has an unknown outcome', async () => {
  const api = new FakeChainApi();
  api.emptyNextCall = true;
  await expect(new GameClient(api, () => 'gnoland-1').withdraw(session, 5)).rejects.toMatchObject({ kind: 'unknown-outcome' });
});
