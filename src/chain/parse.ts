import { caps, poolKey, type Version } from './realms';

export interface BidEntry { n: number; bidder: string; flag: string; price: number; shot: number; clock: number; pot: number; at: number }
export interface Member { addr: string; flag: string; paid: number; earned: number }
export interface ShotEntry { n: number; bidder: string; paid: number; take: number; bps: number; revealAt: number; revealBy: number; resolved: boolean; hit: boolean; void: boolean }

export interface Pool {
  key: string; version: Version; id: number; name: string; creator: string;
  window: number; life: number; basePrice: number; seed: number; pot: number;
  bids: number; nextPrice: number; lastBidder: string; lastBidAt: number; firstBidAt: number;
  deadline: number; lastDay: number; liveBps: number; clock: number; createdAt: number;
  over: boolean; popped: boolean; paid: boolean; cancelled: boolean;
  bidders: number; shots: number; misses: number; pending: number;
  flag: string; teams: Record<string, number>;
  creatorPaid: number; divPaid: number; refPaid: number; treasuryPaid: number;
  winnerPaid: number; teamPaid: number; sharedPaid: number;
  history: BidEntry[]; roster: Member[]; shotlog: ShotEntry[];
}

export interface RealmInfo {
  version: Version; now: number; shotsOn: boolean; keeperSeen: number; commitsFree: number;
  split: Record<string, number>; pools: Pool[];
}

export interface Me {
  addr: string; referrer: string; recruits: number; flag: string; bids: number; paid: number;
  divEarned: number; refEarned: number; won: number; shots: number; hits: number; owed: number; withdrawn: number;
}

export type Teams = Record<string, { paid: number; won: number; players: number }>;

type Obj = Record<string, unknown>;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const bool = (v: unknown) => v === true;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
const numMap = (v: unknown) =>
  Object.fromEntries(Object.entries(obj(v)).filter(([, n]) => typeof n === 'number')) as Record<string, number>;

const hex = (h: string) => parseInt(h, 16);
const u4 = (n: number) => '\\u' + n.toString(16).padStart(4, '0');

/**
 * JSON.parse that also accepts the escapes Go's strconv.Quote emits and JSON lacks:
 * \xHH (a raw byte, kept as U+00HH), \UHHHHHHHH (an astral rune, rewritten as a surrogate pair; above U+10FFFF
 * it throws),
 * \a (BEL) and \v (VT).
 */
export function parseJSONLoose(raw: string): unknown {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== '\\') {
      out += c;
      continue;
    }
    const n = raw[i + 1];
    if (n === 'x' && /^[0-9a-fA-F]{2}$/.test(raw.slice(i + 2, i + 4))) {
      out += u4(hex(raw.slice(i + 2, i + 4)));
      i += 3;
    } else if (n === 'U' && /^[0-9a-fA-F]{8}$/.test(raw.slice(i + 2, i + 10))) {
      const full = hex(raw.slice(i + 2, i + 10));
      if (full > 0x10ffff) throw new Error(`escape \\U${raw.slice(i + 2, i + 10)} is not a Unicode code point`);
      const cp = full - 0x10000;
      out += cp < 0 ? u4(cp + 0x10000) : u4(0xd800 + (cp >> 10)) + u4(0xdc00 + (cp & 0x3ff));
      i += 9;
    } else if (n === 'a' || n === 'v') {
      out += u4(n === 'a' ? 0x07 : 0x0b);
      i += 1;
    } else {
      out += c + (n ?? '');
      i += 1;
    }
  }
  return JSON.parse(out);
}

function load(raw: string, what: string): Obj {
  try {
    return obj(parseJSONLoose(raw));
  } catch (e) {
    throw new Error(`${what}: unreadable answer (${(e as Error).message})`);
  }
}

function toPool(o: Obj, v: Version): Pool {
  const lastBidAt = num(o.lastBidAt);
  const clock = num(o.clock);
  return {
    key: poolKey(v, num(o.id)), version: v, id: num(o.id), name: str(o.name), creator: str(o.creator),
    window: num(o.window), life: num(o.life), basePrice: num(o.basePrice), seed: num(o.seed), pot: num(o.pot),
    bids: num(o.bids), nextPrice: num(o.nextPrice), lastBidder: str(o.lastBidder), lastBidAt,
    firstBidAt: num(o.firstBidAt),
    deadline: num(o.deadline, lastBidAt > 0 ? lastBidAt + clock : 0),
    lastDay: num(o.lastDay), liveBps: num(o.liveBps, 10000), clock, createdAt: num(o.createdAt),
    over: bool(o.over), popped: bool(o.popped), paid: bool(o.paid), cancelled: bool(o.cancelled),
    bidders: num(o.bidders), shots: num(o.shots), misses: num(o.misses), pending: num(o.pending),
    flag: str(o.flag), teams: numMap(o.teams),
    creatorPaid: num(o.creatorPaid), divPaid: num(o.divPaid), refPaid: num(o.refPaid),
    treasuryPaid: num(o.treasuryPaid), winnerPaid: num(o.winnerPaid), teamPaid: num(o.teamPaid),
    sharedPaid: num(o.sharedPaid),
    history: arr(o.history).map((h) => ({
      n: num(h.n), bidder: str(h.bidder), flag: str(h.flag), price: num(h.price), shot: num(h.shot),
      clock: num(h.clock), pot: num(h.pot), at: num(h.at),
    })),
    roster: arr(o.roster).map((m) => ({ addr: str(m.addr), flag: str(m.flag), paid: num(m.paid), earned: num(m.earned) })),
    shotlog: arr(o.shotlog).map((s) => ({
      n: num(s.n), bidder: str(s.bidder), paid: num(s.paid), take: num(s.take), bps: num(s.bps),
      revealAt: num(s.revealAt), revealBy: num(s.revealBy),
      resolved: bool(s.resolved), hit: bool(s.hit), void: bool(s.void),
    })),
  };
}

export function parseRealm(raw: string, v: Version): RealmInfo {
  const o = load(raw, `realm v${v}`);
  return {
    version: v, now: num(o.now), shotsOn: bool(o.shotsOn), keeperSeen: num(o.keeperSeen),
    commitsFree: num(o.commitsFree), split: numMap(o.split),
    // a pool without an id cannot be shown or played: skip it, keep the others
    pools: arr(o.pools).filter((p) => typeof p.id === 'number').map((p) => toPool(p, v)),
  };
}

export const parsePool = (raw: string, v: Version): Pool => toPool(load(raw, `pool v${v}`), v);

/** poolValueExpr's Go for a list of pointers: point each element of the copy `p`'s list at a copy of the stored `o`'s. */
function copyPointers(list: string, type: string): string[] {
  return [`p.${list} = make([]*${type}, len(o.${list}))`, `for i, x := range o.${list} { c := *x; p.${list}[i] = &c }`];
}

/**
 * The qeval expression parsePoolValue reads, in one query: a function literal that copies the pool into new values,
 * which the VM sends whole (a stored object would come as a ref, one more query each), with what its JSON takes
 * from its methods, computed by the realm's own code — v3–v5's last day and live share, v4+'s reveal window.
 * A copied struct keeps its time fields as refs: each is assigned again from the stored one, which copies it.
 * Only the times' locations stay refs, and gnoValueToJS does not read them.
 */
export function poolValueExpr(v: Version, id: number): string {
  // The fields of the struct the function returns, and the Go that computes each: `o` is the stored pool, `p` its copy.
  const fields = [
    { name: 'Pool', type: 'Pool', value: 'p' },
    { name: 'NextPrice', type: 'int64', value: 'o.NextPrice()' },
    { name: 'Deadline', type: 'string', value: 'unix(o.Deadline())' },
    { name: 'Over', type: 'bool', value: 'o.Over()' },
  ];
  if (v >= 3 && v <= 5)
    fields.push({ name: 'LastDay', type: 'string', value: 'unix(o.LastDay())' }, { name: 'LiveBps', type: 'int64', value: 'o.LiveBps()' });
  if (caps(v).shots)
    fields.push({ name: 'ShotDelay', type: 'int64', value: 'ShotDelay' }, { name: 'ShotWindow', type: 'int64', value: 'ShotWindow' });
  const resultType = `struct{ ${fields.map((f) => `${f.name} ${f.type}`).join('; ')} }`;
  const timeFields = v >= 3 ? ['LastBidAt', 'FirstBidAt', 'CreatedAt', 'PoppedAt'] : ['LastBidAt', 'CreatedAt'];
  const body = [
    `o := pool(${id})`,
    'p := *o',
    `${timeFields.map((n) => `p.${n}`).join(', ')} = ${timeFields.map((n) => `o.${n}`).join(', ')}`,
    'p.History = make([]Entry, len(o.History))',
    'for i := range o.History { p.History[i] = o.History[i]; p.History[i].At = o.History[i].At }',
    ...(v >= 2 ? copyPointers('Roster', 'Member') : []),
    ...(v >= 3 ? copyPointers('Shots', 'Shot') : []),
    `return ${resultType}{`,
    `  ${fields.map((f) => f.value).join(', ')},`,
    '}',
  ];
  return [`func() ${resultType} {`, ...body.map((line) => `  ${line}`), '}()'].join('\n');
}

/**
 * parsePool from qeval_json's Amino JSON instead of the realm's Render JSON, so no parseJSONLoose: `answer` is poolValueExpr's
 * result as gnoValueToJS gives it. What the JSON derives from the struct (bidders, pending, the flag, the
 * teams, newest-first lists) is derived here the same way.
 */
export function parsePoolValue(answer: unknown, v: Version): Pool {
  const a = obj(answer);
  const p = obj(a.Pool);
  const roster = arr(p.Roster);
  const shots = arr(p.Shots);
  const teams: Record<string, number> = {};
  for (const m of roster) if (str(m.Flag)) teams[str(m.Flag)] = (teams[str(m.Flag)] ?? 0) + num(m.Paid);
  const reveal = a.ShotDelay !== undefined;
  return toPool(
    {
      id: p.ID, name: p.Name, creator: p.Creator, window: p.Window, life: p.Life, basePrice: p.BasePrice, seed: p.Seed,
      pot: p.Pot, bids: p.Bids, nextPrice: a.NextPrice, lastBidder: p.LastBidder, lastBidAt: p.LastBidAt,
      firstBidAt: p.FirstBidAt, deadline: Number(str(a.Deadline)), lastDay: Number(str(a.LastDay)), liveBps: a.LiveBps,
      clock: p.Clock, createdAt: p.CreatedAt, over: a.Over, popped: p.Popped, paid: p.Paid, cancelled: p.Cancelled,
      bidders: roster.length, shots: shots.length, misses: p.Misses, pending: shots.filter((s) => !bool(s.Resolved)).length,
      flag: str(p.WinnerFlag) || str(roster.find((m) => m.Addr === p.LastBidder)?.Flag), teams,
      creatorPaid: p.CreatorPaid, divPaid: p.DivPaid, refPaid: p.RefPaid, treasuryPaid: p.TreasuryPaid,
      winnerPaid: p.WinnerPaid, teamPaid: p.TeamPaid, sharedPaid: p.SharedPaid,
      history: arr(p.History).reverse().map((h) => ({
        n: h.N, bidder: h.Bidder, flag: h.Flag, price: h.Price, shot: h.Shot, clock: h.Clock, pot: h.Pot, at: h.At,
      })),
      roster: roster.map((m) => ({ addr: m.Addr, flag: m.Flag, paid: m.Paid, earned: m.Earned })),
      shotlog: arr(p.Shots).reverse().map((s) => ({
        n: s.N, bidder: s.Bidder, paid: s.Paid, take: s.Take, bps: s.Bps,
        revealAt: reveal ? num(s.CommitH) + num(a.ShotDelay) : 0,
        revealBy: reveal ? num(s.CommitH) + num(a.ShotDelay) + num(a.ShotWindow) : 0,
        resolved: s.Resolved, hit: s.Won, void: s.Void,
      })),
    },
    v,
  );
}

export function parseMe(raw: string): Me {
  const o = load(raw, 'player');
  return {
    addr: str(o.addr), referrer: str(o.referrer), recruits: num(o.recruits), flag: str(o.flag),
    bids: num(o.bids), paid: num(o.paid), divEarned: num(o.divEarned), refEarned: num(o.refEarned),
    won: num(o.won), shots: num(o.shots), hits: num(o.hits), owed: num(o.owed), withdrawn: num(o.withdrawn),
  };
}

export function parseTeams(raw: string): Teams {
  const o = load(raw, 'teams');
  return Object.fromEntries(
    Object.entries(o).map(([cc, t]) => {
      const x = obj(t);
      return [cc, { paid: num(x.paid), won: num(x.won), players: num(x.players) }];
    }),
  );
}
