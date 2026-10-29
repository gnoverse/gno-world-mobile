import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

/** The top of a full-screen card: its name, what it puts on the right, and ✕. */
export function FullHeader({ title, right, onClose }: { title: string; right?: ReactNode; onClose(): void }) {
  const insets = useSafeAreaInsets();
  return (
    // an iOS sheet starts below the status bar; Android's modal covers the whole screen
    <View style={[styles.head, { paddingTop: (Platform.OS === 'android' ? insets.top : 0) + space.m }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right}>
        {right}
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
          <Text style={styles.x}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.l, paddingBottom: space.s },
  title: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.m, flexShrink: 1 },
  close: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  x: { color: colors.muted, fontSize: 13 },
});
