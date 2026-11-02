import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme';

import { GuideTarget } from '../guide/guide-target';
import { useDemo, demoStore } from '../store';
import { confirmLeave } from './confirm';

/** the badge's height: small enough for the strip under the notch or the Dynamic Island */
const H = 12;
/** between its bottom and the safe area's */
const GAP = 1;

/** where the badge's top goes. iOS: in the top safe area, its bottom just above the inset, so it hides no header
 *  control. Android: just below the inset, because the system's status bar takes every touch in its strip (a badge
 *  there cannot be tapped) and a centred notch would hide it; the header's centre is empty there. */
const badgeTop = (insetTop: number) => (Platform.OS === 'android' ? insetTop + GAP : Math.max(0, insetTop - H - GAP));

/** "DEMO", centred at the top of every screen (see badgeTop); a tap offers to leave. */
export function DemoBadge() {
  const on = useDemo((s) => s.on);
  const insets = useSafeAreaInsets();
  if (!on) return null;
  return (
    <View testID="demo-badge" style={[styles.row, { top: badgeTop(insets.top) }]}>
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
