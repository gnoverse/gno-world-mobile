import { fetchPrices, fetchWhere } from '@/offchain/home';
import type { Offchain } from '@/offchain/http';

test('fetchPrices asks for gnot over the period and reads the reply', async () => {
  const get = jest.fn(async () => ({ coin: 'gnot', now: 0.05822, change: -0.308, cap: 11487970.4, series: [[1793183280, 0.0584], [1793183340, 0.0583]] }));
  const oc = { get } as unknown as Offchain;
  expect(await fetchPrices(oc, 7)).toEqual({ now: 0.05822, change: -0.308, cap: 11487970.4, series: [[1793183280, 0.0584], [1793183340, 0.0583]] });
  expect(get).toHaveBeenCalledWith('/api/prices?coin=gnot&days=7');
});

test('a malformed price reply gives zeros and keeps only finite points', async () => {
  const oc = { get: jest.fn(async () => ({ now: null, series: [[1, 2], ['x', 3], [4], [5, NaN], [6, 7]] })) } as unknown as Offchain;
  expect(await fetchPrices(oc, 1)).toEqual({ now: 0, change: 0, cap: 0, series: [[1, 2], [6, 7]] });
  const oc2 = { get: jest.fn(async () => 'nope') } as unknown as Offchain;
  expect(await fetchPrices(oc2, 1)).toEqual({ now: 0, change: 0, cap: 0, series: [] });
});

test('fetchWhere reads count, countries, elsewhere and geo', async () => {
  const get = jest.fn(async () => ({ by_country: [{ cc: 'FR', n: 3 }, { cc: 'AU', n: 1 }], count: 18, elsewhere: 2, geo: true, pools: {}, spots: [] }));
  const oc = { get } as unknown as Offchain;
  expect(await fetchWhere(oc)).toEqual({ count: 18, byCountry: [{ cc: 'FR', n: 3 }, { cc: 'AU', n: 1 }], elsewhere: 2, geo: true });
  expect(get).toHaveBeenCalledWith('/api/where');
});

test('geo is true only when the server says so; bad rows are dropped', async () => {
  const oc = { get: jest.fn(async () => ({ count: 4, by_country: [{ cc: 'FR', n: 3 }, { cc: 5, n: 1 }, { cc: 'ES' }, null] })) } as unknown as Offchain;
  expect(await fetchWhere(oc)).toEqual({ count: 4, byCountry: [{ cc: 'FR', n: 3 }], elsewhere: 0, geo: false });
});
