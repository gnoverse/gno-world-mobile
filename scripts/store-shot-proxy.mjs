// Store screenshots: proxies gno.world, but serves a staged chat so no real player's name or position is shown.
// Usage: node scripts/store-shot-proxy.mjs, then adb reverse tcp:8791 tcp:8791 and Settings → http://127.0.0.1:8791 (debug build).
// See docs/store/google-play-listing.md.
import { createServer } from 'node:http';

const UP = 'https://gno.world';
const now = () => Math.floor(Date.now() / 1000);
const t0 = now();
const L = (id, ago, name, tag, cc, body, extra = {}) => ({ id, t: t0 - ago, name, tag, cc, body, ...extra });
const msgs = [
  L(101, 1500, 'nova', 'a1f3', 'PT', 'gm from Lisbon ☕'),
  L(102, 1320, 'orbit', '7c21', 'JP', 'gm! the new pool has a 1 h window'),
  L(103, 1100, 'luma', '3e9b', 'CA', 'just booped with 🇨🇦, clock at 25 %', { rx: { '🔥': 3 } }),
  L(104, 900, 'pip', 'b402', 'DE', 'nice. who makes the next bubble?'),
  L(105, 700, 'nova', 'a1f3', 'PT', 'me, after lunch 🫧', { re: { id: 104, name: 'pip', body: 'nice. who makes the next bubble?' } }),
  L(106, 420, 'kiko', '55d0', 'BR', 'first time here, the app works great on my phone', { rx: { '❤️': 4, '👍': 2 } }),
  L(107, 240, 'orbit', '7c21', 'JP', 'welcome kiko! pick a name in the chat and you are set'),
  L(108, 60, 'luma', '3e9b', 'CA', 'two minutes left on the big one 👀', { rx: { '👀': 5 } }),
];
const last = msgs.at(-1).id;
const page = (list) => ({
  build: '', gen: 1, gone: null, here: 21, limit: 80, next: last, now: now(), pins: [], typing: [], upd: [],
  msgs: list, you: { cc: 'FR', tag: '0d0a' },
});

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/api/chat') {
    const since = Number(url.searchParams.get('since') ?? 0);
    const wait = Math.min(Number(url.searchParams.get('wait') ?? 0), 25);
    if (url.searchParams.has('before')) return json(res, { msgs: [], more: false });
    const fresh = msgs.filter((m) => m.id > since);
    if (!fresh.length && wait) await new Promise((r) => setTimeout(r, wait * 1000));
    return json(res, page(fresh));
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = {};
  for (const h of ['x-bid', 'x-name-key', 'x-pid', 'content-type', 'if-match']) if (req.headers[h]) headers[h] = req.headers[h];
  try {
    const r = await fetch(UP + req.url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const out = {};
    for (const h of ['content-type', 'etag', 'retry-after']) if (r.headers.get(h)) out[h] = r.headers.get(h);
    res.writeHead(r.status, out).end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.writeHead(502).end(String(e));
  }
  console.log(req.method, req.url);
}).listen(8791, () => console.log('shot proxy on 8791'));

function json(res, o) {
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(o));
}
