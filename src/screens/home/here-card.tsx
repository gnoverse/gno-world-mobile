import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { Card } from '@/components/card';
import type { Where } from '@/offchain/home';
import { colors, space } from '@/theme';
import { flagEmoji } from '@/utils/flag';

import { hereRows, hereText } from './format';
import { CARD_HEIGHT } from './layout';

export function HereCard({ data, failed }: { data: Where | null; failed: boolean }) {
  const rows = data ? hereRows(data) : [];
  const list = useRef<ScrollViewInstance>(null);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.label}>HERE NOW</Text>
        {data && <Text style={styles.total}>{hereText(data)}</Text>}
      </View>
      {/* a long table scrolls within the card (Android scrolls a list inside the page only when told); a flash of the bar says there is more */}
      <ScrollView
        ref={list}
        testID="here-rows"
        style={styles.rows}
        contentContainerStyle={styles.rowsIn}
        nestedScrollEnabled
        onContentSizeChange={() => list.current?.flashScrollIndicators()}>
        {rows.map((r) => (
          <View key={r.cc || r.name} style={styles.row}>
            <Text style={styles.flag}>{r.cc ? flagEmoji(r.cc) : '·'}</Text>
            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
            <View style={styles.barBox}>{r.share !== null && <View style={[styles.bar, { width: `${Math.round(r.share * 100)}%` }]} />}</View>
            <Text style={styles.n}>{r.n}</Text>
          </View>
        ))}
        {data && !rows.length && <Text style={styles.muted}>nobody yet</Text>}
        {!data && !failed && <Text style={styles.muted}>loading…</Text>}
        {failed && <Text style={styles.muted}>{data ? 'could not refresh — trying again' : 'server unreachable — trying again'}</Text>}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { height: CARD_HEIGHT },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  total: { color: colors.fg, flexShrink: 1, textAlign: 'right' },
  rows: { flex: 1 },
  rowsIn: { gap: space.s, paddingRight: space.s }, // the scroll bar clear of the counts
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  flag: { width: 22, textAlign: 'center', color: colors.muted },
  name: { color: colors.fg, width: 110 },
  barBox: { flex: 1 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  n: { color: colors.muted, minWidth: 24, textAlign: 'right', fontVariant: ['tabular-nums'] },
  muted: { color: colors.muted, fontSize: 12 },
});
