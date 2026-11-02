// A stand-in for gno.world's chat, written from the site's public JS (2026-10-05): the M2a endpoints and
// their rules, and /pair's sync routes (read 2026-10-13), in memory. The name rules were read again on 2026-10-12 (a wallet proof or a boop from the last 3
// minutes; one name a wallet). For the e2e tests, the simulator and the app's demo mode; never a reference for the real server.
// No Node here: requests come in as plain objects, crypto comes in through WorldCrypto.

export const REACTIONS = ['👍', '🔥', '❤️', '😂', '🤔', '🤝', '👎'];
const WINDOW = 900; // edit and take-back, seconds
const OTHER = 'fake-someone-else';

export interface WorldRequest { method: string; path: string; headers: Record<string, string>; body?: Uint8Array; signal?: AbortSignal }
export interface WorldReply { status: number; headers: Record<string, string>; body: Uint8Array }
export interface WorldCrypto {
  sha256Hex(s: string): string;
  randomBytes(n: number): Uint8Array;
  /** '' when the proof holds, else the site's complaint; `challenges` are the phrases handed out (a phrase is good once: delete it) */
  verifyProof?(body: Record<string, unknown>, addr: string, challenges: Set<string>): string;
}
export interface WorldOptions {
  now?: () => number; maxWait?: number; gen?: number; crypto: WorldCrypto;
  /** 'proof': the site's rule (a wallet proof or a boop from the last 3 min); 'open': any name is granted at once */
  names: 'proof' | 'open';
  /** fills Public (and rooms) at start; the Node server passes today's seed (jae, jarvis, cat, bob) */
  seed?: (w: WorldSeedApi) => void;
  /** a well-formed pair code nobody posted: the fake browser answers it; null → 404 as today */
  pairFallback?: (code: string) => Promise<string | null>;
}
export interface WorldSeedApi {
  /** `replyTo` is a line id; `rx` maps an emoji to the names who reacted */
  say(p: { name: string; body: string; room?: string; pinned?: boolean; poll?: { q: string; opts: string[]; votes: number[] }; rx?: Record<string, string[]>; bot?: boolean; tag?: string; replyTo?: number }): number;
  makeRoom(name: string, listed: boolean): { id: string; key: string };
  /** the name's entry when this wallet already holds it */
  reserve(name: string, addr: string): { name: string; key: string };
  writeRecord(id: string, text: string): void;
}
export interface OffchainWorld extends WorldSeedApi {
  handle(req: WorldRequest): Promise<WorldReply>;
  avatar(id: string): { bytes: Uint8Array; type: string } | undefined;
  vanish(roomId: string): void;
  waiting(): string[];
}

interface Line {
  id: number; t: number; name: string; tag: string; cc: string; body: string;
  re?: { id: number; name: string; body: string };
  rxBy: Record<string, string[]>; // emoji -> client ids
  rxNames: Record<string, string[]>;
  ed?: boolean; pinned?: boolean; v?: boolean; av?: string; bot?: boolean;
  poll?: { q: string; opts: string[]; votes: number[] };
  voters?: Record<string, number>;
  author: string;
  changedAt: number;
}

interface Log { lines: Line[]; gone: { id: number; at: number }[]; typing: Map<string, { name: string; n: number; until: number }> }
const newLog = (): Log => ({ lines: [], gone: [], typing: new Map() });
interface Room { id: string; name: string; key: string; listed: boolean; made: number; vanished: boolean; log: Log }
interface Dm { room: string; name: string; from: string; kind: 'room'; at: number }
// the site's words (M2b-2 spec §3)
const NO_SUCH_ROOM = 'no such room — the link may be wrong, or the room was quiet for a month and is gone';
const NOT_MAKER = 'only the room\'s maker can do that';
const ROOM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const CODE_LIFE = 600; // seconds
const BAD_CODE = 'a code is six letters and digits';
const BOOP_PROVES = 180; // seconds a boop proves the wallet, as the site says

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** base64url without padding */
function b64url(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63];
    if (i + 1 < b.length) out += B64URL[(n >> 6) & 63];
    if (i + 2 < b.length) out += B64URL[n & 63];
  }
  return out;
}

function wire(l: Line) {
  const rx: Record<string, number> = {};
  const rxwho: Record<string, string[]> = {};
  for (const [e, bids] of Object.entries(l.rxBy)) if (bids.length) {
    rx[e] = bids.length;
    rxwho[e] = l.rxNames[e] ?? [];
  }
  return {
    id: l.id, t: l.t, name: l.name, tag: l.tag, ...(l.cc ? { cc: l.cc } : {}), body: l.body,
    ...(l.re ? { re: l.re } : {}), ...(Object.keys(rx).length ? { rx, rxwho } : {}),
    ...(l.ed ? { ed: true } : {}), ...(l.pinned ? { pinned: true } : {}), ...(l.v ? { v: true } : {}),
    ...(l.av ? { av: l.av } : {}), ...(l.bot ? { bot: true } : {}), ...(l.poll ? { poll: l.poll } : {}),
  };
}

/** `?a=b&c` as a small lookup (no URL class: React Native's is partial) */
function queryOf(path: string): { pathname: string; get(k: string): string | null; has(k: string): boolean } {
  const i = path.indexOf('?');
  const pathname = i < 0 ? path : path.slice(0, i);
  const map = new Map<string, string>();
  if (i >= 0) {
    for (const part of path.slice(i + 1).split('&')) {
      if (!part) continue;
      const j = part.indexOf('=');
      const dec = (s: string) => {
        try {
          return decodeURIComponent(s.replace(/\+/g, ' '));
        } catch {
          return s;
        }
      };
      const k = dec(j < 0 ? part : part.slice(0, j));
      if (!map.has(k)) map.set(k, j < 0 ? '' : dec(part.slice(j + 1)));
    }
  }
  return { pathname, get: (k) => map.get(k) ?? null, has: (k) => map.has(k) };
}

export function createOffchainWorld(o: WorldOptions): OffchainWorld {
  const now = o.now ?? (() => Math.floor(Date.now() / 1000));
  const maxWait = o.maxWait ?? 55;
  const rnd = (n: number) => o.crypto.randomBytes(n);
  const tagOf = (bid: string) => o.crypto.sha256Hex(bid).slice(0, 4);
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let seq = 0;
  // a new run is a new log, as a real server's reset: clients that knew the old one reload
  let gen = o.gen ?? Date.now() % 1_000_000_000;
  const pub = newLog();
  const rooms = new Map<string, Room>();
  // who last polled under a name: invitations go to them (the site's "whoever last spoke as bob")
  const spokeAs = new Map<string, string>();
  const dms = new Map<string, Dm[]>();
  const pollers = new Map<number, string>();
  let pollSeq = 0;
  const names = new Map<string, { name: string; key: string; addr: string }>();
  const boops = new Map<string, { addr: string; at: number }>();
  const challenges = new Set<string>();
  const avatars = new Map<string, { key: string; bytes: Uint8Array; type: string }>();
  const pairs = new Map<string, { blob: string; until: number }>();
  const records = new Map<string, { v: number; text: string }>();
  const groups: string[] = [];
  const waiters = new Set<() => void>();
  let failNext: { status: number; retryAfter: number } | null = null;

  const wake = () => {
    for (const w of [...waiters]) w();
    waiters.clear();
  };
  const add = (p: Partial<Line> & { name: string; body: string; author: string }, log: Log = pub) => {
    const id = ++seq;
    const l: Line = { id, t: now(), tag: p.author === OTHER ? 'zzzz' : tagOf(p.author), cc: 'FR', rxBy: {}, rxNames: {}, changedAt: id, ...p };
    log.lines.push(l);
    wake();
    return l;
  };
  const touch = (l: Line) => {
    l.changedAt = ++seq;
    wake();
  };
  const makeRoom = (name: string, listed: boolean): Room => {
    const room: Room = { id: [...rnd(20)].map((x) => ROOM_CHARS[x % 64]).join(''), name, key: hex(rnd(16)), listed, made: now(), vanished: false, log: newLog() };
    rooms.set(room.id, room);
    return room;
  };

  const reply = (status: number, body: Uint8Array, headers: Record<string, string> = {}): WorldReply => ({ status, headers, body });
  const send = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    reply(status, enc.encode(JSON.stringify(body)), { 'Content-Type': 'application/json', ...headers });
  const sendText = (status: number, text: string, headers: Record<string, string> = {}) =>
    reply(status, enc.encode(text), { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  const jsonOf = (b: Uint8Array | undefined): Record<string, any> => {
    try {
      const v = JSON.parse((b && dec.decode(b)) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  };

  const page = (log: Log, bid: string, since: number, limit: number, room?: Room) => {
    const t = now();
    for (const [k, v] of log.typing) if (v.until <= t) log.typing.delete(k);
    const msgs = since === 0 ? log.lines.slice(-limit) : log.lines.filter((l) => l.id > since).slice(0, limit);
    return {
      msgs: msgs.map(wire),
      upd: since === 0 ? [] : log.lines.filter((l) => l.id <= since && l.changedAt > since).map(wire),
      gone: log.gone.filter((g) => g.at > since).map((g) => g.id),
      next: seq, gen, now: t, here: room ? 2 : 3, you: { cc: 'FR', tag: tagOf(bid) },
      pins: log.lines.filter((l) => l.pinned).map(wire),
      typing: [...log.typing.entries()].filter(([k]) => k !== bid).map(([, v]) => ({ name: v.name, n: v.n })),
      ...(room ? { name: room.name } : { dm: dms.get(bid) ?? [] }),
      build: 'fake',
    };
  };
  const hasNews = (p: ReturnType<typeof page>) => p.msgs.length + p.upd.length + p.gone.length > 0;

  async function handle(req: WorldRequest): Promise<WorldReply> {
    try {
      const q = queryOf(req.path);
      const pathname = q.pathname;
      const h: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) h[k.toLowerCase()] = v;
      const bid = String(h['x-bid'] ?? 'nobid');
      const key = String(h['x-name-key'] ?? '');
      const route = `${req.method} ${pathname}`;
      const raw = req.body ?? new Uint8Array(0);
      const body = jsonOf(raw);
      // a room's chat: room= on most routes, X-Room on react and vote
      const roomId = q.get('room') ?? String(h['x-room'] ?? '');
      const where = roomId ? rooms.get(roomId) : undefined;
      if (roomId && pathname.startsWith('/api/chat') && (!where || where.vanished)) return send(404, { error: NO_SUCH_ROOM });
      const log = where?.log ?? pub;
      const maker = !!where && String(h['x-room-key'] ?? '') === where.key;

    if (route === 'GET /api/chat') {
      if (failNext) {
        const f = failNext;
        failNext = null;
        return send(f.status, { error: 'busy' }, { 'Retry-After': String(f.retryAfter) });
      }
      if (q.has('before')) {
        const before = Number(q.get('before'));
        const limit = Number(q.get('limit') ?? 100);
        const older = log.lines.filter((l) => l.id < before);
        return send(200, { msgs: older.slice(-limit).map(wire), more: older.length > limit });
      }
      const since = Number(q.get('since') ?? 0);
      const limit = Number(q.get('limit') ?? 80);
      const wait = Math.min(Number(q.get('wait') ?? 0), maxWait);
      if (q.get('name')) spokeAs.set(fold(String(q.get('name'))), bid);
      let p = page(log, bid, since, limit, where);
      if (!hasNews(p) && wait > 0 && !req.signal?.aborted) {
        await new Promise<void>((resolve) => {
          const n = ++pollSeq;
          pollers.set(n, roomId);
          const done = () => {
            pollers.delete(n);
            resolve();
          };
          const timer = setTimeout(done, wait * 1000);
          const early = () => {
            clearTimeout(timer);
            req.signal?.removeEventListener('abort', early);
            done();
          };
          waiters.add(early);
          // a client that gave up (a stopped loop) no longer waits
          req.signal?.addEventListener('abort', early);
        });
        if (req.signal?.aborted) return send(499, { error: 'gone' });
        p = page(log, bid, since, limit, where);
      }
      return send(200, p);
    }

    if (route === 'POST /api/chat') {
      const text = String(body.body ?? '').trim();
      if (!text || text.length > 2000) return send(400, { error: 'say something (2000 characters at most)' });
      const name = String(body.name ?? '').trim() || 'anon';
      const owner = names.get(fold(name));
      if (owner && owner.key !== key) return send(403, { error: `"${name}" is reserved — pick another name` });
      const re = log.lines.find((l) => l.id === Number(body.re));
      const av = typeof body.av === 'string' && avatars.get(body.av)?.key === body.avkey ? body.av : undefined;
      const l = add({
        name: owner ? owner.name : name, body: text, author: bid, v: !!owner, av,
        re: re ? { id: re.id, name: re.name, body: re.body.slice(0, 80) } : undefined,
      }, log);
      log.typing.delete(bid);
      return send(200, { msg: wire(l) });
    }

    if (route === 'PATCH /api/chat') {
      const l = log.lines.find((x) => x.id === Number(q.get('id')));
      if (!l) return send(404, { error: 'no such line' });
      if (l.author !== bid || now() - l.t >= WINDOW) return send(403, { error: 'only your own line, under fifteen minutes old' });
      const text = String(body.body ?? '').trim();
      if (!text) return send(400, { error: 'say something' });
      l.body = text;
      l.ed = true;
      touch(l);
      return send(200, { msg: wire(l) });
    }

    if (route === 'POST /api/chat/pin') {
      if (!maker) return send(403, { error: NOT_MAKER });
      const l = log.lines.find((x) => x.id === Number(q.get('id')));
      if (!l) return send(404, { error: 'no such line' });
      l.pinned = q.get('on') !== '0';
      touch(l);
      return send(200, { pins: log.lines.filter((x) => x.pinned).map(wire), msg: wire(l) });
    }

    if (route === 'DELETE /api/chat') {
      if (!maker) return send(403, { error: NOT_MAKER });
      const i = log.lines.findIndex((x) => x.id === Number(q.get('id')));
      if (i < 0) return send(404, { error: 'no such line' });
      const [l] = log.lines.splice(i, 1);
      log.gone.push({ id: l.id, at: ++seq });
      wake();
      return send(200, { ok: true });
    }

    if (route === 'POST /api/chat/withdraw') {
      const l = log.lines.at(-1);
      if (!l || l.author !== bid || now() - l.t >= WINDOW) return send(200, { deleted: 0 });
      log.lines.pop();
      log.gone.push({ id: l.id, at: ++seq });
      wake();
      return send(200, { deleted: l.id });
    }

    if (route === 'POST /api/chat/react') {
      const l = log.lines.find((x) => x.id === Number(body.id));
      const emoji = String(body.emoji ?? '');
      if (!REACTIONS.includes(emoji)) return send(400, { error: 'not a reaction' });
      if (!l) return send(404, { error: 'no such line' });
      const by = (l.rxBy[emoji] ??= []);
      const who = (l.rxNames[emoji] ??= []);
      const i = by.indexOf(bid);
      if (i >= 0) {
        by.splice(i, 1);
        who.splice(i, 1);
      } else {
        by.push(bid);
        who.push(String(body.name ?? 'anon'));
      }
      touch(l);
      const w = wire(l);
      return send(200, { rx: w.rx ?? {}, mine: i < 0 });
    }

    if (route === 'POST /api/chat/vote') {
      const l = log.lines.find((x) => x.id === Number(body.id));
      const opt = Number(body.opt);
      if (!l?.poll || !(opt >= 0 && opt < l.poll.opts.length)) return send(400, { error: 'no such option' });
      l.voters ??= {};
      const prev = l.voters[bid];
      if (prev !== undefined) l.poll.votes[prev]--;
      l.poll.votes[opt]++;
      l.voters[bid] = opt;
      touch(l);
      return send(200, { mine: opt, poll: l.poll });
    }

    if (route === 'POST /api/chat/typing') {
      const n = Number(body.n) || 0;
      if (n > 0) log.typing.set(bid, { name: String(body.name ?? 'anon'), n, until: now() + 6 });
      else log.typing.delete(bid);
      wake();
      return send(200, {});
    }

    if (route === 'POST /api/room' && !q.has('id')) {
      const name = String(body.name ?? '').trim().slice(0, 120);
      if (!name) return send(400, { error: 'a room needs a name' });
      const r = makeRoom(name, body.public === true);
      return send(200, { id: r.id, name: r.name, key: r.key });
    }
    if (pathname === '/api/room' || pathname === '/api/room/invite') {
      const r = rooms.get(q.get('id') ?? q.get('room') ?? '');
      if (!r || r.vanished) return send(404, { error: NO_SUCH_ROOM });
      if (req.method === 'GET') return send(200, { id: r.id, name: r.name, public: r.listed, here: 2, made: r.made, announce: '' });
      if (String(h['x-room-key'] ?? '') !== r.key) return send(403, { error: NOT_MAKER });
      if (route === 'DELETE /api/room') {
        rooms.delete(r.id);
        wake();
        return send(200, { ok: true });
      }
      if (route === 'POST /api/room/invite') {
        const to = String(body.to ?? '').trim();
        const who = spokeAs.get(fold(to));
        if (!who) return send(404, { error: `nobody spoke as ${to} lately` });
        const list = dms.get(who) ?? [];
        list.push({ room: r.id, name: r.name, from: String(body.name ?? 'anon'), kind: 'room', at: now() });
        dms.set(who, list);
        wake();
        return send(200, { to });
      }
      if (typeof body.name === 'string') {
        r.name = body.name.trim().slice(0, 120) || r.name;
        wake();
        return send(200, { name: r.name });
      }
      if (typeof body.public === 'boolean') r.listed = body.public;
      return send(200, {});
    }
    if (route === 'GET /api/rooms') {
      return send(200, {
        rooms: [...rooms.values()].filter((r) => r.listed && !r.vanished)
          .map((r) => ({ id: r.id, name: r.name, slug: r.name.toLowerCase(), here: 2, voice: 0, made: r.made, lat: 0, lon: 0 })),
      });
    }

    if (route === 'POST /api/bubble/boop') {
      const addr = String(body.addr ?? '');
      if (!/^g1[0-9a-z]{38}$/.test(addr) || !(Number(body.pool) > 0) || !(Number(body.n) > 0)) return send(400, { error: 'bad boop report' });
      boops.set(bid, { addr, at: now() });
      return send(200, { ok: true });
    }

    if (route === 'GET /api/name/challenge') {
      const words = `fake: prove this wallet is yours · ${b64url(rnd(12))}`;
      challenges.add(words);
      return send(200, { words });
    }

    if (route === 'POST /api/name') {
      const addr = String(body.addr ?? '');
      if (!/^g1[0-9a-z]{38}$/.test(addr)) return send(400, { error: 'connect your wallet first' });
      const held = [...names.values()].find((e) => e.addr === addr);
      if (held) return send(409, { error: `this wallet holds the name ${held.name} already — one name a wallet` });
      const boop = boops.get(bid);
      if (o.names === 'proof' && !(boop?.addr === addr && now() - boop.at <= BOOP_PROVES)) {
        if (!body.doc) {
          return send(409, { error: 'Connect your wallet and let it sign the phrase this page asks for — a boop from the last 3 minutes does the same.' });
        }
        const why = o.crypto.verifyProof ? o.crypto.verifyProof(body, addr, challenges) : 'this box cannot check a proof';
        if (why) return send(409, { error: why });
      }
      const name = String(body.name ?? '').trim();
      if (!name || name.length > 32) return send(400, { error: 'a name of 1 to 32 characters' });
      const taken = names.get(fold(name));
      if (taken && taken.addr !== addr) return send(409, { error: 'that name or a look-alike is taken' });
      const entry = { name, key: hex(rnd(16)), addr };
      names.set(fold(name), entry);
      return send(200, entry);
    }
    if (route === 'GET /api/name') {
      if (q.has('addr')) return send(200, { name: [...names.values()].find((e) => e.addr === q.get('addr'))?.name ?? '' });
      const e = names.get(fold(q.get('name') ?? ''));
      const mine = !!e && !!key && key === e.key;
      return send(200, e ? { name: e.name, reserved: true, by: e.addr, mine, ...(mine ? { addr: e.addr } : {}) } : { name: q.get('name') ?? '' });
    }
    if (route === 'DELETE /api/name') {
      const e = [...names.entries()].find(([, v]) => key && v.key === key);
      if (!e) return send(404, { error: 'no reserved name for this key' });
      names.delete(e[0]);
      return send(200, { ok: true });
    }

    if (route === 'POST /api/avatar') {
      const type = String(h['content-type'] ?? '');
      if (!type.startsWith('image/')) return send(400, { error: 'a picture, please' });
      if (raw.length === 0 || raw.length > 2_000_000) return send(400, { error: 'a picture under 2 MB' });
      const id = b64url(rnd(6)).toLowerCase().replace(/[^a-z0-9]/g, 'x').slice(0, 8);
      const k = hex(rnd(8));
      avatars.set(id, { key: k, bytes: raw, type });
      return send(200, { id, key: k });
    }
    const av = /^\/api\/avatar\/([a-z0-9]+)\.jpg$/.exec(pathname);
    if (req.method === 'GET' && av) {
      const a = avatars.get(av[1]);
      if (!a) return send(404, { error: 'no such picture' });
      return reply(200, a.bytes, { 'Content-Type': a.type });
    }

    if (route === 'POST /api/sync/pair') {
      const code = String(body.code ?? '');
      const blob = String(body.blob ?? '');
      if (!CODE_RE.test(code)) return send(400, { error: BAD_CODE });
      if (!blob || blob.length > 4096) return send(400, { error: 'no key to hand over' });
      const had = pairs.get(code);
      if (had && had.until > now()) return send(409, { error: 'that code is in use' });
      pairs.set(code, { blob, until: now() + CODE_LIFE });
      return send(200, { ok: true });
    }
    const pairCode = /^\/api\/sync\/pair\/([^/]*)$/.exec(pathname);
    if (req.method === 'GET' && pairCode) {
      const code = decodeURIComponent(pairCode[1]);
      if (!CODE_RE.test(code)) return send(400, { error: BAD_CODE });
      const p = pairs.get(code);
      pairs.delete(code); // a code works once
      if (!p || p.until <= now()) {
        // a well-formed code nobody posted: a fake browser may have it (demo mode)
        const blob = o.pairFallback ? await o.pairFallback(code) : null;
        if (blob) return send(200, { blob });
      }
      if (!p || p.until <= now()) return send(404, { error: 'no such code — it may have been used, or it is older than ten minutes' });
      return send(200, { blob: p.blob });
    }
    const sync = /^\/api\/sync\/([0-9a-f]{64})$/.exec(pathname);
    if (sync && req.method === 'GET') {
      const r = records.get(sync[1]);
      return r ? sendText(200, r.text, { ETag: String(r.v) }) : send(404, { error: 'nothing here yet' });
    }
    if (sync && req.method === 'PUT') {
      const v = records.get(sync[1])?.v ?? 0;
      if (String(h['if-match'] ?? '') !== String(v)) return send(412, { error: 'changed meanwhile — read it again' });
      if (raw.length === 0 || raw.length > 65536) return send(400, { error: 'a sealed record of 64 KB at most' });
      records.set(sync[1], { v: v + 1, text: dec.decode(raw) });
      return send(200, { ok: true }, { ETag: String(v + 1) });
    }
    if (pathname.startsWith('/api/sync/')) return sendText(404, '404 page not found');
    if (route === 'POST /presence') {
      const g = q.get('g');
      if (g && !groups.includes(g)) groups.push(g);
      return send(200, { you: 'FR', count: 3 });
    }
    // the Home tab: fixed prices and a fixed crowd
    if (route === 'GET /api/prices') {
      const days = Number(q.get('days')) || 1;
      const at = Math.floor(Date.now() / 1000);
      const step = (days * 86400) / 59;
      const series = Array.from({ length: 60 }, (_, i) => [Math.round(at - (59 - i) * step), Number((0.0582 + 0.002 * Math.sin(i / 6) * (1 - i / 59)).toFixed(5))]);
      // every third point traded nothing, as on the real chart
      const volumes = series.map(([t], i) => [t, i % 3 ? Math.round(100 + 900 * Math.abs(Math.cos(i))) : 0]);
      return send(200, { coin: 'gnot', name: 'GNOT', days, now: 0.0582, at, change: -0.31, cap: 11487970.4, supply: 1333000000, fdv: 77713900, series, volumes });
    }
    if (route === 'GET /api/where') {
      const spots = [{ cc: 'FR', lat: 48.75, lon: 2.25, n: 2 }, { cc: 'FR', lat: 45.75, lon: 4.75, n: 1 }, { cc: 'ES', lat: 40.5, lon: -3.75, n: 1 }];
      return send(200, { by_country: [{ cc: 'FR', n: 3 }, { cc: 'ES', n: 1 }], count: 5, elsewhere: 1, geo: true, spots });
    }

    // test-only routes
    if (route === 'POST /__test/say') {
      const l = add({ name: String(body.name ?? 'zed'), body: String(body.body ?? 'hi'), author: OTHER, pinned: !!body.pinned, bot: !!body.bot });
      return send(200, { msg: wire(l) });
    }
    if (route === 'POST /__test/name') {
      const name = String(body.name ?? '');
      names.set(fold(name), { name, key: String(body.key ?? ''), addr: String(body.addr ?? '') });
      return send(200, { ok: true });
    }
    if (route === 'GET /__test/presence') return send(200, { groups });
    if (route === 'POST /__test/gen') {
      gen++;
      wake();
      return send(200, { gen });
    }
    if (route === 'POST /__test/fail') {
      failNext = { status: Number(body.status) || 503, retryAfter: Number(body.retryAfter) || 1 };
      return send(200, {});
    }
    if (route === 'POST /__test/age') {
      const l = pub.lines.find((x) => x.id === Number(body.id));
      if (l) l.t -= Number(body.seconds) || 0;
      return send(200, {});
    }
      return send(404, { error: `no route ${route}` });
    } catch (e) {
      return send(500, { error: String(e) });
    }
  }

  const api: OffchainWorld = {
    handle,
    say: (p) => {
      const log = p.room ? rooms.get(p.room)?.log : pub;
      if (!log) throw new Error(`no such room ${p.room}`);
      const re = p.replyTo === undefined ? undefined : log.lines.find((x) => x.id === p.replyTo);
      const l = add({
        name: p.name, body: p.body, author: p.bot ? 'fake-bot' : OTHER, pinned: p.pinned, bot: p.bot, poll: p.poll,
        ...(p.tag ? { tag: p.tag } : {}),
        ...(re ? { re: { id: re.id, name: re.name, body: re.body } } : {}),
      }, log);
      for (const [emoji, who] of Object.entries(p.rx ?? {})) {
        l.rxBy[emoji] = who.map(() => OTHER);
        l.rxNames[emoji] = [...who];
      }
      return l.id;
    },
    makeRoom: (name, listed) => {
      const room = makeRoom(name, listed);
      return { id: room.id, key: room.key };
    },
    reserve: (name, addr) => {
      const had = names.get(fold(name));
      if (had) {
        if (had.addr !== addr) throw new Error(`${name} is held by another wallet`);
        return { name: had.name, key: had.key };
      }
      const entry = { name, key: hex(rnd(16)), addr };
      names.set(fold(name), entry);
      return { name: entry.name, key: entry.key };
    },
    writeRecord: (id, text) => {
      records.set(id, { v: (records.get(id)?.v ?? 0) + 1, text });
    },
    avatar: (id) => {
      const a = avatars.get(id);
      return a && { bytes: a.bytes, type: a.type };
    },
    vanish: (roomId) => {
      const room = rooms.get(roomId);
      if (room) room.vanished = true;
      wake();
    },
    waiting: () => [...pollers.values()],
  };
  o.seed?.(api);
  return api;
}
