import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme';

import { GuideTarget } from '../guide/guide-target';
import { useDemo, demoStore } from '../store';
import { confirmLeave } from './confirm';

/** the badge's height: small enough for the strip under the notch or the Dynamic Island */
const H = 12;
/** between its bottom and the safe area's */
const GAP = 1;

/** "DEMO", centred in the top safe area above every screen, its bottom just above the inset so it hides no header
 *  control; a tap offers to leave. */
export function DemoBadge() {
  const on = useDemo((s) => s.on);
  const insets = useSafeAreaInsets();
  if (!on) return null;
  return (
    <View testID="demo-badge" style={[styles.row, { top: Math.max(0, insets.top - H - GAP) }]}>
      <GuideTarget id="demo.badge">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Demo mode — tap to leave"
          hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
          style={styles.badge}
          onPress={async () => {
            if (!(await confirmLeave())) return;
            demoStore.getState().leave();
            router.replace('/');
          }}>
          <Text style={styles.t} allowFontScaling={false} numberOfLines={1}>DEMO</Text>
        </Pressable>
      </GuideTarget>
    </View>
  );
}

const styles = StyleSheet.create({
  // the row spans the width to centre the badge; touches beside it go through
  row: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000, elevation: 10, pointerEvents: 'box-none' },
  badge: {
    height: H, justifyContent: 'center', backgroundColor: colors.accent, borderRadius: radius.s, paddingHorizontal: space.xs + 2,
  },
  t: { color: colors.bg, fontSize: 9, lineHeight: H, fontWeight: '900', letterSpacing: 1 },
});
