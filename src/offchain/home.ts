import type { Offchain } from './http';

/** The periods of the site's price window. */
export type PriceDays = 1 | 7 | 30;
export const PRICE_DAYS: PriceDays[] = [1, 7, 30];

export interface Prices {
  /** USD; null: the reply had no price (the site then says "no prices right now") */
  now: number | null;
  /** percent, the server's 24h figure whatever the period */
  change: number;
  /** market cap, USD */
  cap: number;
  /** [seconds, USD], ascending */
  series: [number, number][];
}

export interface Where {
  count: number;
  /** largest first, as the server sorts it */
  byCountry: { cc: string; n: number }[];
  /** here, but without a country */
  elsewhere: number;
  /** false: this server build cannot place people */
  geo: boolean;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const obj = (r: unknown) => (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;

export async function fetchPrices(oc: Offchain, days: PriceDays): Promise<Prices> {
  const o = obj(await oc.get<unknown>(`/api/prices?coin=gnot&days=${days}`));
  const series = (Array.isArray(o.series) ? o.series : []).filter(
    (p): p is [number, number] => Array.isArray(p) && p.length >= 2 && isNum(p[0]) && isNum(p[1]),
  );
  return { now: isNum(o.now) ? o.now : null, change: num(o.change), cap: num(o.cap), series: series.map(([t, p]) => [t, p]) };
}

export async function fetchWhere(oc: Offchain): Promise<Where> {
  const o = obj(await oc.get<unknown>('/api/where'));
  const byCountry = (Array.isArray(o.by_country) ? o.by_country : [])
    .map(obj)
    .filter((c) => typeof c.cc === 'string' && isNum(c.n))
    .map((c) => ({ cc: c.cc as string, n: c.n as number }));
  // the site reads a missing geo as "countries unavailable"
  return { count: num(o.count), byCountry, elsewhere: num(o.elsewhere), geo: o.geo === true };
}
