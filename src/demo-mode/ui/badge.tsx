import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme';

import { GuideTarget } from '../guide/guide-target';
import { useDemo, demoStore } from '../store';
import { confirmLeave } from './confirm';

/** "DEMO", in the top safe area above every screen; a tap offers to leave. */
export function DemoBadge() {
  const on = useDemo((s) => s.on);
  const insets = useSafeAreaInsets();
  if (!on) return null;
  return (
    <GuideTarget id="demo.badge" style={[styles.at, { top: insets.top + 2 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Demo mode — tap to leave"
        style={styles.badge}
        onPress={async () => {
          if (!(await confirmLeave())) return;
          demoStore.getState().leave();
          router.replace('/');
        }}>
        <Text style={styles.t}>DEMO</Text>
      </Pressable>
    </GuideTarget>
  );
}

const styles = StyleSheet.create({
  at: { position: 'absolute', right: space.m, zIndex: 1000, elevation: 10 },
  badge: {
    backgroundColor: colors.accent, borderRadius: radius.s, paddingHorizontal: space.s, paddingVertical: 2,
  },
  t: { color: colors.bg, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
