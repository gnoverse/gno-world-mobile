import { createHash, randomBytes } from 'node:crypto';

import { createOffchainWorld, type WorldOptions, type WorldReply } from './offchain-world';

const crypto: WorldOptions['crypto'] = {
  sha256Hex: (s) => createHash('sha256').update(s).digest('hex'),
  randomBytes: (n) => new Uint8Array(randomBytes(n)),
};
const ADDR = `g1${'a'.repeat(38)}`;
const json = (r: WorldReply) => JSON.parse(new TextDecoder().decode(r.body));
const post = (path: string, body: unknown) => ({ method: 'POST', path, headers: { 'content-type': 'application/json' }, body: new TextEncoder().encode(JSON.stringify(body)) });

describe('createOffchainWorld', () => {
  it('open names are granted without proof', async () => {
    const w = createOffchainWorld({ crypto, names: 'open' });
    const r = await w.handle(post('/api/name', { name: 'ann', addr: ADDR }));
    expect(r.status).toBe(200);
    expect(json(r).key).toMatch(/^[0-9a-f]{32}$/);
  });

  it('proof names still ask for a proof', async () => {
    const w = createOffchainWorld({ crypto, names: 'proof' });
    const r = await w.handle(post('/api/name', { name: 'ann', addr: ADDR }));
    expect(r.status).toBe(409);
  });

  it('a long poll ends when its signal aborts', async () => {
    const w = createOffchainWorld({ crypto, names: 'open' });
    const first = json(await w.handle({ method: 'GET', path: '/api/chat?since=0&wait=0', headers: {} }));
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 10);
    const t = Date.now();
    await w.handle({ method: 'GET', path: `/api/chat?since=${first.next}&wait=30`, headers: {}, signal: ctl.signal });
    expect(Date.now() - t).toBeLessThan(200);
    expect(w.waiting()).toEqual([]);
  });

  it('the seed callback fills Public', async () => {
    const w = createOffchainWorld({ crypto, names: 'open', seed: (s) => { s.say({ name: 'jae', body: 'hello' }); } });
    const p = json(await w.handle({ method: 'GET', path: '/api/chat?since=0&wait=0&limit=80', headers: {} }));
    expect(p.msgs).toHaveLength(1);
    expect(p.msgs[0]).toMatchObject({ name: 'jae', body: 'hello' });
  });

  it('asks pairFallback only for a well-formed unposted code', async () => {
    const pairFallback = jest.fn(async () => 'BLOB');
    const w = createOffchainWorld({ crypto, names: 'open', pairFallback });
    expect((await w.handle({ method: 'GET', path: '/api/sync/pair/nope', headers: {} })).status).toBe(400);
    expect(pairFallback).not.toHaveBeenCalled();
    const ok = await w.handle({ method: 'GET', path: '/api/sync/pair/ABCDEF', headers: {} });
    expect(json(ok)).toEqual({ blob: 'BLOB' });
  });

  it('reserve returns the existing entry for the same wallet', () => {
    const w = createOffchainWorld({ crypto, names: 'open' });
    expect(w.reserve('ann', ADDR)).toEqual(w.reserve('ann', ADDR));
  });
});
