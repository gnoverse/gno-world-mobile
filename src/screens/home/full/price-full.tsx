import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fetchPrices, PRICES_EVERY_MS, type PriceDays, type Prices } from '@/offchain/home';
import { useServices } from '@/state/app-services';
import { colors, space } from '@/theme';

import { formatChange, formatPrice, readoutText, shortNum, shortUsd } from '../format';
import { NO_PRICES, Periods, PRICES_BUSY } from '../price-card';
import { usePoll } from '../use-poll';
import { FullHeader } from './full-header';
import { PriceChart } from './price-chart';

// the site's chart colours (priceDraw), by the sign of the change
const UP = '#3ddc84';
const DOWN = '#ff7676';

/** The figures under the chart; one the server does not give (0) is left out. */
function figures(p: Prices, days: PriceDays): [string, string][] {
  const prices = p.series.map(([, v]) => v);
  const vol = p.volumes.reduce((s, [, v]) => s + v, 0);
  const all: [string, string, number][] = [
    ['fdv', shortUsd(p.fdv), p.fdv],
    ['market cap', shortUsd(p.cap), p.cap],
    ['supply', `${shortNum(p.supply, 2)} GNOT`, p.supply],
    [`${days}d volume`, shortUsd(vol), p.volumes.length],
    [`${days}d high`, formatPrice(Math.max(...prices)), prices.length],
    [`${days}d low`, formatPrice(Math.min(...prices)), prices.length],
  ];
  return all.filter(([, , v]) => v > 0).map(([k, s]) => [k, s]);
}

export function PriceFull({ initialDays }: { initialDays: PriceDays }) {
  const { offchain } = useServices();
  const [days, setDays] = useState<PriceDays>(initialDays);
  const prices = usePoll(() => fetchPrices(offchain, days), PRICES_EVERY_MS, String(days));
  const p = prices.data;
  // as the card: no price, or fewer than 2 points, is no prices at all; kept per reply, so a finger moving over the
  // chart does not rebuild it
  const shown = useMemo(() => (p && p.now !== null && p.series.length >= 2 ? { ...p, now: p.now } : null), [p]);
  const [picked, setPicked] = useState<number | null>(null);
  const point = shown && picked !== null ? shown.series[picked] : undefined;
  const vol = point && shown?.volumes.find(([t]) => t === point[0]);
  // while a finger reads the chart, sliding it down must not close the sheet
  const navigation = useNavigation();
  const reading = point !== undefined;
  useEffect(() => navigation.setOptions({ gestureEnabled: !reading }), [navigation, reading]);
  return (
    <View style={styles.root}>
      <FullHeader title="GNOT" right={<Periods days={days} onDays={setDays} />} onClose={() => router.back()} />
      {shown ? (
        <>
          <View style={styles.now}>
            <Text style={styles.price}>{formatPrice(shown.now)}</Text>
            <Text style={{ color: shown.change < 0 ? colors.bad : colors.ring }}>{formatChange(shown.change)}</Text>
          </View>
          <Text style={[styles.small, styles.readout]}>{point ? readoutText(point[0], point[1], vol ? vol[1] : null) : ''}</Text>
          <View style={[styles.chart, prices.stale && styles.stale]}>
            <PriceChart data={shown} days={days} color={shown.change < 0 ? DOWN : UP} picked={point ? picked : null} onPick={setPicked} />
          </View>
          <View style={styles.grid}>
            {figures(shown, days).map(([k, v]) => (
              <View key={k} style={styles.cell}>
                <Text style={styles.small}>{k}</Text>
                <Text style={styles.value}>{v}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          {p && !prices.stale && <Text style={styles.small}>{NO_PRICES}</Text>}
          {(!p || prices.stale) && !prices.failed && <Text style={styles.small}>loading…</Text>}
        </View>
      )}
      {prices.failed && <Text style={[styles.small, styles.note]}>{PRICES_BUSY}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingBottom: space.xl },
  now: { flexDirection: 'row', alignItems: 'baseline', gap: space.s, paddingHorizontal: space.l },
  price: { color: colors.fg, fontSize: 28, fontWeight: '600' },
  readout: { paddingHorizontal: space.l, minHeight: 16 },
  chart: { flex: 1, paddingLeft: space.l, paddingTop: space.s },
  stale: { opacity: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.l, paddingTop: space.m, rowGap: space.m },
  cell: { width: '50%' },
  small: { color: colors.muted, fontSize: 12 },
  value: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center', paddingTop: space.s },
});
