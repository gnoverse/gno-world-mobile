import type { Where } from '@/offchain/home';
import { countryName } from '@/utils/country';

export function formatPrice(usd: number): string {
  const d = usd < 1 ? 4 : 2;
  return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** a sign always; the site writes "-" and 1 decimal, here the real minus sign and 2 decimals */
export const formatChange = (pct: number) => `${pct < 0 ? '−' : '+'}${Math.abs(pct).toFixed(2)}%`;

const CAP_UNITS: [number, string][] = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'k'],
];

export function formatCap(usd: number): string {
  // the largest unit that still reads 1 or more once rounded: 999,950 is $1M, not $1000k
  for (const [div, unit] of CAP_UNITS) {
    const v = Number((usd / div).toFixed(1));
    if (v >= 1) return `cap $${v}${unit}`;
  }
  return `cap $${Math.round(usd)}`;
}

/** The site's words for the total (herePaint). */
export function hereText(w: Where): string {
  const n = w.count === 0 ? 'nobody here right now' : w.count === 1 ? 'just you' : `${w.count} people`;
  return n + (w.geo ? '' : ' · countries unavailable on this build');
}

export interface HereRow {
  cc: string;
  name: string;
  n: number;
  /** 0..1 of the biggest row; null: no bar */
  share: number | null;
}

/** The site's table; empty means "nobody yet". */
export function hereRows(w: Where): HereRow[] {
  // without countries, everyone in one row rather than an empty table (decided 2026-10-29)
  if (!w.geo) return w.count > 0 ? [{ cc: '', name: 'unknown', n: w.count, share: 1 }] : [];
  const max = Math.max(1, ...w.byCountry.map((c) => c.n));
  const rows: HereRow[] = w.byCountry.map((c) => ({ cc: c.cc, name: countryName(c.cc), n: c.n, share: c.n / max }));
  if (w.elsewhere > 0) rows.push({ cc: '', name: 'elsewhere', n: w.elsewhere, share: null });
  return rows;
}

export interface ChartGeom {
  /** an SVG polyline's points */
  points: string;
  min: number;
  max: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function chartGeom(series: [number, number][], width: number, height: number): ChartGeom | null {
  if (series.length < 2) return null;
  const prices = series.map(([, p]) => p);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const t0 = series[0][0];
  const span = series[series.length - 1][0] - t0 || 1;
  const points = series
    .map(([t, p]) => `${r1(((t - t0) / span) * width)},${r1(max === min ? height / 2 : (height * (max - p)) / (max - min))}`)
    .join(' ');
  return { points, min, max };
}
