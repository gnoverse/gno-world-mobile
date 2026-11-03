// The Node face of the fake gno.world: an HTTP server around the platform-neutral core in
// src/demo-mode/world/offchain-world.ts (the app's demo mode runs the same core). For the e2e tests and the simulator;
// never a reference for the real server.
import { createHash, createPublicKey, ECDH, randomBytes, verify } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';

import { bech32 } from 'bech32';

import { createOffchainWorld, type WorldSeedApi } from '../../src/demo-mode/world/offchain-world.ts';

export { REACTIONS } from '../../src/demo-mode/world/offchain-world.ts';

export interface FakeOptions { host?: string; now?: () => number; maxWait?: number; gen?: number }
export interface FakeServer {
  url: string;
  close(): Promise<void>;
  /** the room is gone (404 everywhere), as one quiet for a month */
  vanish(roomId: string): void;
  /** long polls waiting right now, by room ('' is Public) */
  waiting(): string[];
}

const addressOf = (pub: Buffer) =>
  bech32.encode('g', bech32.toWords(createHash('ripemd160').update(createHash('sha256').update(pub).digest()).digest()));

/** The site's proof check as seen from outside: the key's address must be addr, the phrase one handed out. */
function proofError(body: Record<string, any>, addr: string, challenges: Set<string>): string {
  try {
    const pub = Buffer.from(String(body.pub), 'base64');
    if (pub.length !== 33) return 'that key is not a key';
    const owner = addressOf(pub);
    if (owner !== addr) return `that signature does not prove this wallet: that key belongs to ${owner.slice(0, 8)}`;
    const doc = JSON.parse(String(body.doc));
    const msg = doc?.msgs?.[0]?.value;
    const words = Buffer.from(String(msg?.data ?? ''), 'base64').toString('utf8');
    if (msg?.signer !== addr || !challenges.has(words)) return 'that phrase is not one this box handed out';
    const un = ECDH.convertKey(pub, 'secp256k1', undefined, undefined, 'uncompressed') as Buffer;
    const key = createPublicKey({
      key: { kty: 'EC', crv: 'secp256k1', x: un.subarray(1, 33).toString('base64url'), y: un.subarray(33).toString('base64url') },
      format: 'jwk',
    });
    if (!verify('sha256', Buffer.from(String(body.doc)), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(String(body.sig), 'base64'))) {
      return 'that signature does not check out';
    }
    challenges.delete(words); // a phrase is good once
    return '';
  } catch {
    return 'that proof is unreadable';
  }
}

// seed: what a first page shows on the site
function seed(w: WorldSeedApi) {
  const hello = w.say({ name: 'jae', body: 'welcome to the chat — be kind', pinned: true });
  w.say({ name: 'jarvis', body: 'on it — the workshop reads this now', bot: true, tag: 'jrvs', replyTo: hello });
  w.say({ name: 'cat', body: 'which pool tonight?', poll: { q: 'which pool tonight?', opts: ['the big one', 'rapid fire'], votes: [2, 1] } });
  w.say({ name: 'bob', body: 'gl everyone', rx: { '🔥': ['cat'] } });
}

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });

export async function startFakeServer(port = 0, o: FakeOptions = {}): Promise<FakeServer> {
  const world = createOffchainWorld({
    now: o.now, maxWait: o.maxWait, gen: o.gen, names: 'proof', seed,
    crypto: {
      sha256Hex: (t) => createHash('sha256').update(t).digest('hex'),
      randomBytes: (n) => new Uint8Array(randomBytes(n)),
      verifyProof: proofError,
    },
  });

  const server = createServer(async (req, res) => {
    const gone = new AbortController();
    res.on('close', () => gone.abort());
    try {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : v;
      const raw = await readBody(req);
      const out = await world.handle({ method: req.method ?? 'GET', path: req.url ?? '/', headers, body: new Uint8Array(raw), signal: gone.signal });
      if (res.destroyed) return;
      res.writeHead(out.status, out.headers);
      res.end(Buffer.from(out.body));
    } catch (e) {
      if (!res.destroyed) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(port, o.host ?? '127.0.0.1', resolve));
  const addr = server.address();
  const actual = typeof addr === 'object' && addr ? addr.port : port;
  return {
    url: `http://${o.host ?? '127.0.0.1'}:${actual}`,
    vanish: (roomId) => world.vanish(roomId),
    waiting: () => world.waiting(),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
