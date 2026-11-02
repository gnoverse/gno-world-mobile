import { createHash, randomBytes } from 'node:crypto';

import { createChatClient } from '@/offchain/chat/client';
import { OffchainError } from '@/offchain/http';
import { createSyncClient } from '@/offchain/sync/client';

import { createOffchainWorld, type WorldOptions } from './offchain-world';
import { avatarDataUri, createWorldOffchain } from './world-offchain';

const crypto: WorldOptions['crypto'] = {
  sha256Hex: (s) => createHash('sha256').update(s).digest('hex'),
  randomBytes: (n) => new Uint8Array(randomBytes(n)),
};
const ADDR = `g1${'a'.repeat(38)}`;
const BID = 'aaaaaaaaaaaaaaaa';
const ident = async () => ({ name: 'ann', nameKey: '' } as never);

describe('createWorldOffchain', () => {
  it('the chat client posts and polls', async () => {
    const w = createOffchainWorld({ crypto, names: 'open' });
    const c = createChatClient(createWorldOffchain(w, BID), ident);
    await c.post('ann', 'hi');
    const r = await c.poll({ since: 0, wait: 0 } as never, { timeoutMs: 5000, signal: new AbortController().signal });
    expect(JSON.stringify(r)).toContain('hi');
  });

  it('errors keep the server\'s status', async () => {
    const w = createOffchainWorld({ crypto, names: 'open' });
    w.reserve('ann', ADDR);
    const c = createChatClient(createWorldOffchain(w, BID), ident);
    const err = await c.reserveName('ann', `g1${'b'.repeat(38)}`).catch((e: unknown) => e) as OffchainError;
    expect(err).toBeInstanceOf(OffchainError);
    expect(err.status).toBe(409);
  });

  it('the sync client reads 404 as version 0', async () => {
    const w = createOffchainWorld({ crypto, names: 'open' });
    expect(await createSyncClient(createWorldOffchain(w, BID)).pull('a'.repeat(64))).toEqual({ version: 0, blob: null });
  });

  it('an uploaded avatar becomes a data URI', async () => {
    const w = createOffchainWorld({ crypto, names: 'open' });
    const c = createChatClient(createWorldOffchain(w, BID), ident);
    const { id } = await c.uploadAvatar(new Uint8Array([1, 2, 3]), 'image/jpeg');
    expect(avatarDataUri(w, id)).toBe('data:image/jpeg;base64,AQID');
    expect(avatarDataUri(w, 'nope')).toBe('');
  });

  it('an aborted long poll is a server-unreachable error', async () => {
    const w = createOffchainWorld({ crypto, names: 'open' });
    const oc = createWorldOffchain(w, BID);
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 10);
    const err = await oc.get('/api/chat?since=99&wait=30', { signal: ctl.signal }).catch((e: unknown) => e) as OffchainError;
    expect(err).toBeInstanceOf(OffchainError);
    expect(err.status).toBe(0);
  });
});
