import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { Card } from '@/components/card';
import { PRICE_DAYS, type PriceDays, type Prices } from '@/offchain/home';
import { colors, radius, space } from '@/theme';

import { chartGeom, formatCap, formatChange, formatPrice } from './format';
import { CARD_HEIGHT } from './layout';

const BUSY = 'prices are busy — trying again'; // the site's words
const NONE = 'no prices right now'; // the site's words for a reply without prices (priceLoad)

export function PriceCard({
  data,
  stale = false,
  failed,
  days,
  onDays,
}: {
  data: Prices | null;
  /** data is another period's, this one's is loading: the price holds (the same whatever the period), the chart dims */
  stale?: boolean;
  failed: boolean;
  days: PriceDays;
  onDays(d: PriceDays): void;
}) {
  const [plot, setPlot] = useState({ width: 0, height: 0 });
  // as the site: no price, or fewer than 2 points, is no prices at all — never a $0
  const shown = data && data.now !== null && data.series.length >= 2 ? { ...data, now: data.now } : null;
  const geom = shown && plot.width && plot.height ? chartGeom(shown.series, plot.width, plot.height) : null;
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.label}>GNOT</Text>
        <View style={styles.seg}>
          {PRICE_DAYS.map((d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={d === 1 ? '1 day' : `${d} days`}
              accessibilityState={{ selected: d === days }}
              onPress={() => onDays(d)}
              style={[styles.segBtn, d === days && styles.segOn]}>
              <Text style={[styles.segText, d === days && styles.segTextOn]}>{d}d</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {shown && (
        <View style={styles.now}>
          <Text style={styles.price}>{formatPrice(shown.now)}</Text>
          <Text style={{ color: shown.change < 0 ? colors.bad : colors.ring }}>{formatChange(shown.change)}</Text>
        </View>
      )}
      <View testID="price-chart-box" accessibilityState={{ busy: stale }} style={[styles.chart, stale && styles.stale]}>
        {geom && <Text style={styles.small}>{formatPrice(geom.max)}</Text>}
        {/* the chart takes the height the card leaves it */}
        <View testID="price-plot" style={styles.plot} onLayout={(e) => setPlot({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
          {geom && (
            <Svg testID="price-chart" width={plot.width} height={plot.height} style={styles.svg}>
              <Polyline points={geom.points} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinejoin="round" />
            </Svg>
          )}
          {data && !shown && !stale && <Text style={styles.small}>{NONE}</Text>}
          {(!data || (stale && !shown)) && !failed && <Text style={styles.small}>loading…</Text>}
        </View>
        {geom && <Text style={styles.small}>{formatPrice(geom.min)}</Text>}
      </View>
      {shown && shown.cap > 0 && <Text style={styles.small}>{formatCap(shown.cap)}</Text>}
      {failed && <Text style={styles.small}>{BUSY}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { height: CARD_HEIGHT },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  seg: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.s, padding: 2, gap: 2 },
  segBtn: { paddingVertical: space.xs, paddingHorizontal: space.s, borderRadius: radius.s },
  segOn: { backgroundColor: colors.line },
  segText: { color: colors.muted, fontSize: 12 },
  segTextOn: { color: colors.fg },
  now: { flexDirection: 'row', alignItems: 'baseline', gap: space.s },
  price: { color: colors.fg, fontSize: 24, fontWeight: '600' },
  small: { color: colors.muted, fontSize: 11 },
  stale: { opacity: 0.4 },
  chart: { flex: 1 },
  plot: { flex: 1, justifyContent: 'center', overflow: 'hidden' },
  svg: { position: 'absolute', top: 0, left: 0 },
});
