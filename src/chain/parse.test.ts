import { readFileSync } from 'fs';
import { join } from 'path';

import { parseJSONLoose, parseMe, parsePool, parsePoolValue, parseRealm, parseTeams, poolValueExpr } from '@/chain/parse';

const fx = (n: string) => readFileSync(join(__dirname, '__fixtures__', n), 'utf8');

test('parseJSONLoose accepts Go strconv.Quote escapes', () => {
  expect(parseJSONLoose('"a\\x80b"')).toBe('a\u0080b');
  expect(parseJSONLoose('"\\U0001F600"')).toBe('😀');
  expect(parseJSONLoose('"\\\\x80"')).toBe('\\x80'); // an escaped backslash stays one
  expect(parseJSONLoose('"a\\vb\\ac"')).toBe('a\u000bb\u0007c');
  expect(parseJSONLoose('"\\\\v"')).toBe('\\v');
});

test('parseRealm v5', () => {
  const r = parseRealm(fx('v5-realm.json'), 5);
  expect(r.version).toBe(5);
  expect(r.now).toBe(1790860635);
  expect(r.shotsOn).toBe(true);
  expect(r.commitsFree).toBe(58);
  expect(r.split.minShot).toBe(100000);
  expect(r.pools).toHaveLength(3);
  const [p1, p2, p99] = r.pools;
  expect(p1).toMatchObject({ key: 'v5-1', name: 'first light', over: true, paid: true, nextPrice: 707107 });
  expect(p2).toMatchObject({ key: 'v5-2', bids: 22, liveBps: 8475, teams: { US: 10730502, DK: 2345208 } });
  expect(p2.history).toEqual([]);
  expect(p99.name).toContain('bad');
});

test('parsePool v5 detail', () => {
  const p = parsePool(fx('v5-pool.json'), 5);
  expect(p.history[0]).toEqual({
    n: 22, bidder: 'g1r9mekllcz0fqdt0w2lstckw9exxtvzpqy5hazp', flag: 'DK',
    price: 2345208, shot: 0, clock: 43200, pot: 74109299, at: 1790840331,
  });
  expect(p.roster[0].earned).toBe(4489534);
  expect(p.shotlog[0]).toMatchObject({ n: 3, bps: 99, resolved: true, hit: false });
});

test('parseRealm v1 fills what older versions lack', () => {
  const p = parseRealm(fx('v1-realm.json'), 1).pools[0];
  expect(p.key).toBe('v1-6');
  expect(p.life).toBe(0);
  expect(p.liveBps).toBe(10000);
  expect(p.deadline).toBe(0); // no bid yet
  expect(p.teams).toEqual({});
});

test('parseMe and parseTeams', () => {
  expect(parseMe(fx('v5-me.json'))).toMatchObject({ owed: 323186, flag: 'GB', referrer: 'g1c3wqq0ldvh5qt4tznwdyn0jzpzx26gfmc3l34s' });
  expect(parseTeams(fx('v5-teams.json')).US).toEqual({ paid: 64479008, won: 421848014, players: 7 });
});

test('garbage is a clear error', () => {
  expect(() => parseRealm('not json', 5)).toThrow(/realm v5/);
});

test('parseJSONLoose refuses an escape that is no code point', () => {
  expect(() => parseJSONLoose('"\\U00110000"')).toThrow(/not a Unicode code point/);
  expect(() => parseRealm('{"pools":[{"id":1,"name":"\\U00110000"}]}', 5)).toThrow(/unreadable answer/);
});

test('parseJSONLoose leaves malformed escapes to JSON, which refuses them', () => {
  expect(() => parseJSONLoose('"\\x4"')).toThrow(SyntaxError);
  expect(() => parseJSONLoose('"abc\\')).toThrow(SyntaxError);
});

test('one malformed pool does not poison the realm', () => {
  const r = parseRealm('{"now":1,"pools":["oops",{"id":7,"name":"ok"},{"name":"no id"}]}', 5);
  expect(r.pools.map((p) => p.key)).toEqual(['v5-7']);
});

test('a v6 pool has no last day: life is 0 and the winner takes the whole rest', () => {
  const p = parsePool(fx('v6-pool.json'), 6);
  expect(p).toMatchObject({ key: 'v6-1', version: 6, life: 0, liveBps: 10000 });
});

test("poolValueExpr copies each version's pool and asks its methods for what its JSON computes", () => {
  expect(poolValueExpr(6, 3)).toBe(`func() struct{ Pool Pool; NextPrice int64; Deadline string; Over bool; ShotDelay int64; ShotWindow int64 } {
  o := pool(3)
  p := *o
  p.LastBidAt, p.FirstBidAt, p.CreatedAt, p.PoppedAt = o.LastBidAt, o.FirstBidAt, o.CreatedAt, o.PoppedAt
  p.History = make([]Entry, len(o.History))
  for i := range o.History { p.History[i] = o.History[i]; p.History[i].At = o.History[i].At }
  p.Roster = make([]*Member, len(o.Roster))
  for i, x := range o.Roster { c := *x; p.Roster[i] = &c }
  p.Shots = make([]*Shot, len(o.Shots))
  for i, x := range o.Shots { c := *x; p.Shots[i] = &c }
  return struct{ Pool Pool; NextPrice int64; Deadline string; Over bool; ShotDelay int64; ShotWindow int64 }{
    p, o.NextPrice(), unix(o.Deadline()), o.Over(), ShotDelay, ShotWindow,
  }
}()`);
  expect(poolValueExpr(4, 1)).toMatch(/LastDay string; LiveBps int64; ShotDelay int64; ShotWindow int64 }/);
  expect(poolValueExpr(3, 1)).toMatch(/Over bool; LastDay string; LiveBps int64 }.*p\.Shots = /s);
  const v2 = poolValueExpr(2, 1);
  expect(v2).toContain('\n  p.LastBidAt, p.CreatedAt = o.LastBidAt, o.CreatedAt\n');
  expect(v2).toContain('p.Roster = ');
  expect(v2).not.toContain('Shots');
  expect(poolValueExpr(1, 1)).toMatch(/Over bool }/);
  expect(poolValueExpr(1, 1)).not.toContain('Roster');
});

test('parsePoolValue derives what the JSON derives from the struct', () => {
  const answer = {
    Pool: {
      ID: 2, LastBidder: 'g1b', WinnerFlag: '', LastBidAt: 50, Clock: 10,
      History: [{ N: 1 }, { N: 2 }],
      Roster: [
        { Addr: 'g1a', Flag: 'US', Paid: 5 }, { Addr: 'g1b', Flag: 'FR', Paid: 3 }, { Addr: 'g1c', Flag: 'US', Paid: 2 },
        { Addr: 'g1d', Flag: '', Paid: 9 },
      ],
      Shots: [{ N: 1, CommitH: 100, Resolved: true }, { N: 2, CommitH: 110, Resolved: false }],
    },
    NextPrice: 7, Deadline: '60', Over: false, ShotDelay: 3, ShotWindow: 2,
  };
  const p = parsePoolValue(answer, 6);
  expect(p).toMatchObject({
    key: 'v6-2', nextPrice: 7, deadline: 60, lastDay: 0, liveBps: 10000, bidders: 4, shots: 2, pending: 1,
    flag: 'FR', teams: { US: 7, FR: 3 },
  });
  expect(p.history.map((h) => h.n)).toEqual([2, 1]); // newest first, as the JSON
  expect(p.shotlog.map((s) => [s.n, s.revealAt, s.revealBy])).toEqual([[2, 113, 115], [1, 103, 105]]);
  expect(parsePoolValue({ ...answer, Pool: { ...answer.Pool, WinnerFlag: 'US' } }, 6).flag).toBe('US');
  // v3 has no reveal window in its JSON
  const { ShotDelay, ShotWindow, ...v3 } = answer;
  expect(parsePoolValue({ ...v3, LastDay: '90', LiveBps: 9808 }, 3)).toMatchObject({ lastDay: 90, liveBps: 9808 });
  expect(parsePoolValue(v3, 3).shotlog[0]).toMatchObject({ revealAt: 0, revealBy: 0 });
});
