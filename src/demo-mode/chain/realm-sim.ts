import { clockFor, price } from '@/game/pricing';
import { encodeAddress } from '@/utils/bech32';

import { DEMO_COUNTRY } from '../constants';

/** What the realm accepts when a pool is created (invented limits in the real realm's wording). */
const MIN_WINDOW = 300;
const MAX_WINDOW = 86_400;
const MIN_BASE = 100_000;
const MIN_SEED = 1_000_000;
const MAX_NAME = 32;

interface Entry { n: number; bidder: string; flag: string; price: number; shot: number; clock: number; pot: number; at: number }

interface PoolState {
  id: number; name: string; creator: string; window: number; basePrice: number; seed: number; pot: number;
  bids: number; nextPrice: number; lastBidder: string; lastBidAt: number; firstBidAt: number; deadline: number;
  clock: number; createdAt: number; cancelled: boolean; paid: boolean; winnerPaid: number;
  history: Entry[]; roster: Map<string, { flag: string; paid: number }>;
}

interface Player { flag: string; bids: number; paid: number; won: number; owed: number; withdrawn: number }

/** Invented valid addresses of the players who booped before the visitor (fixed bytes, so they never change). */
const bytes = (n: number) => new Uint8Array(20).map((_, i) => (n * 37 + i * 11 + 5) & 0xff);
const EARLIER = [encodeAddress(bytes(1)), encodeAddress(bytes(2)), encodeAddress(bytes(3)), encodeAddress(bytes(4))];

/** The realm's rules, in memory: just enough of bubblerumble6 for the game screens (no shots, no dividends). */
export class RealmSim {
  private pools = new Map<number, PoolState>();
  private players = new Map<string, Player>();
  private nextId = 1;

  constructor(private now: () => number) {
    const t = now();
    const mk = (name: string, creator: string, window: number, basePrice: number, seed: number) =>
      this.makePool(creator, name, window, basePrice, seed, t - 7200);
    // 1: live, 2: over, 3: the guided pool (live), 4: over, 5: live
    const a = mk('🌊 splash lane', EARLIER[0], 1800, 500_000, 5_000_000);
    this.seedBoops(a, [[EARLIER[1], 'ES'], [EARLIER[2], 'JP'], [EARLIER[0], 'ES']], t - 900, 1500);
    const b = mk('🍋 lemon fizz', EARLIER[1], 900, 250_000, 3_000_000);
    this.seedBoops(b, [[EARLIER[2], 'JP'], [EARLIER[3], 'US']], t - 3600, 600, true);
    const c = mk('🫧 demo bubble', EARLIER[2], 3600, 1_000_000, 10_000_000);
    this.seedBoops(c, [[EARLIER[3], 'US'], [EARLIER[1], 'ES']], t - 600, 2700);
    const d = mk('🐚 shell game', EARLIER[3], 600, 400_000, 2_000_000);
    this.seedBoops(d, [[EARLIER[0], 'ES'], [EARLIER[1], 'ES'], [EARLIER[3], 'US']], t - 5400, 480, true);
    const e = mk('🎈 balloon pop', EARLIER[0], 7200, 750_000, 8_000_000);
    this.seedBoops(e, [[EARLIER[2], 'JP']], t - 300, 5000);
  }

  private player(addr: string): Player {
    let p = this.players.get(addr);
    if (!p) this.players.set(addr, (p = { flag: '', bids: 0, paid: 0, won: 0, owed: 0, withdrawn: 0 }));
    return p;
  }

  private makePool(creator: string, name: string, window: number, basePrice: number, seed: number, at: number): PoolState {
    const p: PoolState = {
      id: this.nextId++, name, creator, window, basePrice, seed, pot: seed, bids: 0, nextPrice: basePrice,
      lastBidder: '', lastBidAt: 0, firstBidAt: 0, deadline: 0, clock: window, createdAt: at, cancelled: false,
      paid: false, winnerPaid: 0, history: [], roster: new Map(),
    };
    this.pools.set(p.id, p);
    return p;
  }

  /** Earlier boops at the base price, the last one `lastAgo` seconds before now, leaving `left` seconds on the clock. */
  private seedBoops(p: PoolState, boops: [string, string][], lastAt: number, left: number, over = false) {
    boops.forEach(([addr, flag], i) => {
      const at = lastAt - (boops.length - 1 - i) * 120;
      this.apply(p, addr, flag, p.nextPrice, at);
    });
    p.deadline = over ? this.now() - 60 : this.now() + left;
    p.clock = p.deadline - p.lastBidAt;
    if (over) this.settle(p);
  }

  private apply(p: PoolState, addr: string, flag: string, sent: number, at: number) {
    const clock = clockFor(p.window, p.nextPrice, sent);
    p.pot += Math.floor(sent / 2);
    p.bids += 1;
    p.history.push({ n: p.bids, bidder: addr, flag, price: p.nextPrice, shot: 0, clock, pot: p.pot, at });
    p.lastBidder = addr;
    p.lastBidAt = at;
    if (p.bids === 1) p.firstBidAt = at;
    p.clock = clock;
    p.deadline = at + clock;
    p.nextPrice = price(p.basePrice, p.bids);
    const r = p.roster.get(addr) ?? { flag, paid: 0 };
    r.flag = flag;
    r.paid += sent;
    p.roster.set(addr, r);
    const pl = this.player(addr);
    pl.flag = flag;
    pl.bids += 1;
    pl.paid += sent;
  }

  /** The pool's winner gets the pot: into their owed balance until they withdraw. */
  private settle(p: PoolState) {
    if (p.paid) return;
    p.paid = true;
    p.winnerPaid = p.pot;
    const w = this.player(p.lastBidder);
    w.won += p.pot;
    w.owed += p.pot;
  }

  private pool(id: number): PoolState {
    const p = this.pools.get(id);
    if (!p) throw new Error(`bad pool id ${id}`);
    return p;
  }

  private isOver(p: PoolState) {
    return p.bids > 0 && this.now() >= p.deadline;
  }

  private teamOf(p: PoolState) {
    const t: Record<string, number> = {};
    for (const r of p.roster.values()) t[r.flag] = (t[r.flag] ?? 0) + r.paid;
    return t;
  }

  private poolJson(p: PoolState) {
    const teams = this.teamOf(p);
    const lead = Object.entries(teams).sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
    return {
      id: p.id, name: p.name, creator: p.creator, window: p.window, basePrice: p.basePrice, seed: p.seed, pot: p.pot,
      bids: p.bids, nextPrice: p.nextPrice, lastBidder: p.lastBidder, lastBidAt: p.lastBidAt, firstBidAt: p.firstBidAt,
      deadline: p.deadline, lastDay: 0, liveBps: 10000, clock: p.clock, createdAt: p.createdAt,
      over: this.isOver(p), popped: false, paid: p.paid, cancelled: p.cancelled, bidders: p.roster.size,
      divPaid: 0, refPaid: 0, creatorPaid: 0, treasuryPaid: 0, shotPaid: 0, teamPaid: 0, sharedPaid: 0,
      winnerPaid: p.winnerPaid, shots: 0, misses: 0, voided: 0, late: 0, pending: 0, escrow: 0, flag: lead, teams,
      history: p.history,
      roster: [...p.roster].map(([addr, r]) => ({ addr, flag: r.flag, paid: r.paid, earned: 0 })),
      shotlog: [],
    };
  }

  /** 'json' | 'json/<id>' | 'me/<addr>' | 'teams' */
  renderJson(args: string): string {
    const now = this.now();
    if (args === 'json') {
      return JSON.stringify({
        now, height: 1000, shotsOn: false, keeperSeen: now, commitsFree: 0,
        split: { pot: 50, div: 30, ref: 10, creator: 5, treasury: 5, team: 35 },
        pools: [...this.pools.values()].map((p) => this.poolJson(p)),
      });
    }
    const one = /^json\/(\d+)$/.exec(args);
    if (one) return JSON.stringify(this.poolJson(this.pool(Number(one[1]))));
    const me = /^me\/(.+)$/.exec(args);
    if (me) {
      const pl = this.players.get(me[1]);
      return JSON.stringify({
        addr: me[1], referrer: '', recruits: 0, flag: pl?.flag ?? DEMO_COUNTRY, bids: pl?.bids ?? 0, paid: pl?.paid ?? 0,
        divEarned: 0, refEarned: 0, won: pl?.won ?? 0, shots: 0, hits: 0, owed: pl?.owed ?? 0, withdrawn: pl?.withdrawn ?? 0,
      });
    }
    if (args === 'teams') {
      const t: Record<string, { paid: number; won: number; players: number }> = {};
      for (const pl of this.players.values()) {
        if (!pl.flag) continue;
        const x = (t[pl.flag] ??= { paid: 0, won: 0, players: 0 });
        x.paid += pl.paid;
        x.won += pl.won;
        x.players += 1;
      }
      return JSON.stringify(t);
    }
    throw new Error(`unknown render path "${args}"`);
  }

  bid(addr: string, id: number, flag: string, sent: number): void {
    const p = this.pool(id);
    if (p.cancelled) throw new Error('pool was cancelled');
    if (this.isOver(p)) throw new Error('pool is closed');
    if (sent < p.nextPrice) throw new Error(`send at least ${p.nextPrice}ugnot, got ${sent}ugnot`);
    this.apply(p, addr, flag || DEMO_COUNTRY, sent, this.now());
  }

  claim(_addr: string, id: number): void {
    const p = this.pool(id);
    if (!this.isOver(p)) throw new Error('pool is not over');
    if (p.paid) throw new Error(`nothing to claim: pool ${id} was already paid`);
    // anyone may trigger the payout; the winner is credited
    this.settle(p);
  }

  cancel(addr: string, id: number): void {
    const p = this.pool(id);
    if (p.creator !== addr) throw new Error('only the creator can cancel');
    if (p.bids > 0) throw new Error('pool already has boops');
    if (p.cancelled) throw new Error('pool was cancelled');
    p.cancelled = true;
    this.player(addr).owed += p.seed;
  }

  withdraw(addr: string): number {
    const pl = this.player(addr);
    if (pl.owed <= 0) throw new Error('nothing to withdraw');
    const paid = pl.owed;
    pl.owed = 0;
    pl.withdrawn += paid;
    return paid;
  }

  createPool(addr: string, name: string, window: number, basePrice: number, seed: number): number {
    const n = [...name.trim()].length;
    if (n < 1 || n > MAX_NAME) throw new Error(`name must be 1 to ${MAX_NAME} characters`);
    if (!Number.isFinite(window) || window < MIN_WINDOW || window > MAX_WINDOW)
      throw new Error(`window must be between ${MIN_WINDOW} and ${MAX_WINDOW} seconds`);
    if (!Number.isFinite(basePrice) || basePrice < MIN_BASE) throw new Error(`base price must be at least ${MIN_BASE}ugnot`);
    if (seed < MIN_SEED) throw new Error(`send at least ${MIN_SEED}ugnot, got ${seed}ugnot`);
    return this.makePool(addr, name.trim(), window, basePrice, seed, this.now()).id;
  }

  endNow(id: number): void {
    this.pool(id).deadline = this.now() - 1;
  }
}
