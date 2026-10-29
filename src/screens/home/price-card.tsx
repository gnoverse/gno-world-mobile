import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { Card } from '@/components/card';
import { PRICE_DAYS, type PriceDays, type Prices } from '@/offchain/home';
import { colors, radius, space } from '@/theme';

import { chartGeom, formatCap, formatChange, formatPrice } from './format';

const CHART_HEIGHT = 80;
const BUSY = 'prices are busy — trying again'; // the site's words

export function PriceCard({ data, failed, days, onDays }: { data: Prices | null; failed: boolean; days: PriceDays; onDays(d: PriceDays): void }) {
  const [width, setWidth] = useState(0);
  const geom = data && width ? chartGeom(data.series, width, CHART_HEIGHT) : null;
  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.label}>GNOT</Text>
        <View style={styles.seg}>
          {PRICE_DAYS.map((d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: d === days }}
              onPress={() => onDays(d)}
              style={[styles.segBtn, d === days && styles.segOn]}>
              <Text style={[styles.segText, d === days && styles.segTextOn]}>{d}d</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {data && (
        <View style={styles.now}>
          <Text style={styles.price}>{formatPrice(data.now)}</Text>
          <Text style={{ color: data.change < 0 ? colors.bad : colors.ring }}>{formatChange(data.change)}</Text>
        </View>
      )}
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {geom && (
          <>
            <Text style={styles.small}>{formatPrice(geom.max)}</Text>
            <Svg testID="price-chart" width={width} height={CHART_HEIGHT}>
              <Polyline points={geom.points} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinejoin="round" />
            </Svg>
            <Text style={styles.small}>{formatPrice(geom.min)}</Text>
          </>
        )}
      </View>
      {data && <Text style={styles.small}>{formatCap(data.cap)}</Text>}
      {failed && <Text style={styles.small}>{BUSY}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
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
});
