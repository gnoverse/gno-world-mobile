import { useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { colors, radius, space } from '@/theme';

import { demoStore, useDemo } from '../store';
import { STEPS, TAB_LABELS } from './steps';
import { targetsStore } from './targets';

const DOT = 14;
const ARROW = 12;
/** between the target and the bubble's edge (the arrow sits in it) */
const GAP = 10;
const MAX_WIDTH = 360;
/** room kept for the bubble when a target sits near an edge */
const ROOM = 180;
/** above the tab bar, for a bubble with nothing to point at */
const TAB_BAR = 56;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

/**
 * The guide's step, in a white bubble with an arrow at what it is about and a pulsing dot on it; the app around stays
 * usable. It points at the step's first target on screen; with none, at its way in (`via`), else at the tab to open.
 * On a screen pushed over the tabs (no tab bar) it points at nothing there: the tabs stay mounted under it, so their
 * places may still be known. Nothing outside demo mode or once the guide is over.
 */
export function GuideBubble() {
  const on = useDemo((s) => s.on);
  const step = useDemo((s) => s.guideStep);
  const rects = useStore(targetsStore, (s) => s.rects);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // the tab bar shows on the tabs' screens only (none known yet: the first screen, a tab)
  const first: string | undefined = useSegments()[0];
  const tabBar = !first || first === '(tabs)';
  const st = on && step !== null ? STEPS[step] : undefined;
  if (!st || step === null) return null;

  const hit = st.targets.find((id) => rects[id]);
  const via = !hit && tabBar && st.via && rects[st.via] ? rects[st.via] : undefined;
  const anchor = hit ? rects[hit] : via ?? (tabBar ? rects[`tab.${st.tab}`] : undefined);
  const body = hit
    ? st.body
    : via
      ? 'Open this pool to continue.'
      : tabBar
        ? `Open ${TAB_LABELS[st.tab]} to continue.`
        : `Go back, then open ${TAB_LABELS[st.tab]}.`;
  const last = step === STEPS.length - 1;

  const bw = Math.min(width - 2 * space.l, MAX_WIDTH);
  let place: { left: number; top?: number; bottom?: number };
  let arrow: { left: number; top?: number; bottom?: number } | null = null;
  let dot: { left: number; top: number } | null = null;
  if (anchor) {
    const cx = anchor.x + anchor.w / 2;
    const cy = anchor.y + anchor.h / 2;
    const left = clamp(cx - bw / 2, space.l, width - space.l - bw);
    const below = cy < height / 2;
    place = below
      ? { left, top: clamp(anchor.y + anchor.h + GAP, insets.top + space.s, height - insets.bottom - ROOM) }
      : { left, bottom: clamp(height - anchor.y + GAP, insets.bottom + space.s, height - insets.top - ROOM) };
    const ax = clamp(cx - left - ARROW / 2, radius.m, bw - radius.m - ARROW);
    arrow = below ? { left: ax, top: -ARROW / 2 } : { left: ax, bottom: -ARROW / 2 };
    dot = { left: cx - DOT / 2, top: cy - DOT / 2 };
  } else {
    place = { left: (width - bw) / 2, bottom: insets.bottom + (tabBar ? TAB_BAR : 0) + space.s };
  }

  return (
    <View style={styles.overlay}>
      {dot ? <Pulse at={dot} /> : null}
      <View testID="guide-bubble" style={[styles.bubble, { width: bw }, place]}>
        {arrow ? <View style={[styles.arrow, arrow]} /> : null}
        <Text style={styles.title}>{st.title}</Text>
        <Text style={styles.body} accessibilityLiveRegion="polite">{body}</Text>
        <View style={styles.foot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip" hitSlop={8} onPress={() => demoStore.getState().skip()}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
          <View style={styles.dots} accessible accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dotStep, i === step && styles.dotNow]} />
            ))}
          </View>
          <Pressable
            accessibilityRole="button" accessibilityLabel={last ? 'Done' : 'Next'} hitSlop={8} style={styles.next}
            onPress={() => demoStore.getState().next()}>
            <Text style={styles.nextText}>{last ? 'Done' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** the accent dot on the target, a ring growing out of it; taps go through to the target */
function Pulse({ at }: { at: { left: number; top: number } }) {
  const [{ t, ring }] = useState(() => {
    const v = new Animated.Value(0);
    const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });
    const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
    return { t: v, ring: { opacity, transform: [{ scale }] } };
  });
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <View testID="guide-dot" style={[styles.dot, at]}>
      <Animated.View style={[styles.ring, ring]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 2000, elevation: 20, pointerEvents: 'box-none' },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.accent, pointerEvents: 'none' },
  ring: { ...StyleSheet.absoluteFill, borderRadius: DOT / 2, backgroundColor: colors.accent },
  bubble: {
    position: 'absolute', backgroundColor: '#fff', borderRadius: radius.m + 2, padding: space.m, gap: space.xs,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 12,
  },
  arrow: { position: 'absolute', width: ARROW, height: ARROW, backgroundColor: '#fff', transform: [{ rotate: '45deg' }] },
  title: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  body: { color: colors.bg, fontSize: 14, lineHeight: 19 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.s, gap: space.s },
  skip: { color: colors.muted, fontSize: 14 },
  dots: { flexDirection: 'row', gap: 4, flexShrink: 1 },
  dotStep: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ccc' },
  dotNow: { backgroundColor: colors.bg },
  next: { backgroundColor: colors.bg, borderRadius: radius.s + 2, paddingHorizontal: space.m, paddingVertical: space.xs + 2 },
  nextText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
