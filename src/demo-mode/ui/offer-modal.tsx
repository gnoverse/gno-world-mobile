import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useSettingsHydrated } from '@/state/settings';
import { colors, radius, space } from '@/theme';

import { demoStore } from '../store';
import { DEMO_OFFERED_KEY } from './confirm';

/** what the guided tour has you do, with the tabs' icons */
const TOUR: { icon: SymbolViewProps['name']; title: string; body: string }[] = [
  { icon: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum' }, title: 'Say hello', body: 'Chat and react — only you see it.' },
  { icon: { ios: 'bubbles.and.sparkles', android: 'bubble_chart' }, title: 'Boop a pool', body: 'Beat the clock and claim the pot.' },
  { icon: { ios: 'key.fill', android: 'key' }, title: 'Cash out', body: 'Pair a browser, then withdraw your winnings.' },
];

/** The offer itself: Settings opens it too. `onClose` runs after either button. */
export function DemoOfferDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" statusBarTranslucent visible onRequestClose={onClose}>
      <View style={styles.scrim}>
        <ScrollView contentContainerStyle={styles.center} bounces={false}>
          <View style={styles.card} accessibilityViewIsModal>
            <View style={styles.mark}>
              <View style={styles.halo}>
                <Image source={GNOME} style={styles.gnome} resizeMode="contain" accessibilityIgnoresInvertColors />
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText} allowFontScaling={false}>DEMO</Text>
              </View>
            </View>
            <View style={styles.head}>
              <Text style={styles.h} accessibilityRole="header">Try gno.world in demo mode?</Text>
              <Text style={styles.t}>Everything is simulated: nothing is sent, nothing is kept.</Text>
            </View>
            <View style={styles.tour}>
              {TOUR.map((s) => (
                <View key={s.title} style={styles.row} accessible>
                  <View style={styles.tile}>
                    <SymbolView name={s.icon} tintColor={colors.ring} size={18} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{s.title}</Text>
                    <Text style={styles.rowBody}>{s.body}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.note}>A guide walks you through. Tap DEMO to leave.</Text>
            <View style={styles.actions}>
              <Button
                title="Try the demo"
                onPress={() => {
                  onClose();
                  demoStore.getState().enter();
                  router.replace('/');
                }}
              />
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={space.s} style={({ pressed }) => [styles.later, pressed && styles.dim]}>
                <Text style={styles.laterText}>Not now</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** The first-launch offer: once settings have hydrated and the flag has been read, if it was never shown. */
export function DemoOffer() {
  const hydrated = useSettingsHydrated();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    void (async () => {
      let offered = false;
      try {
        offered = (await AsyncStorage.getItem(DEMO_OFFERED_KEY)) !== null;
      } catch {
        // an unreadable flag counts as "not offered"; the flag is set below, so it happens once
      }
      if (!alive || offered) return;
      setShown(true);
      void AsyncStorage.setItem(DEMO_OFFERED_KEY, '1').catch(() => undefined);
    })();
    return () => {
      alive = false;
    };
  }, [hydrated]);
  return <DemoOfferDialog visible={shown} onClose={() => setShown(false)} />;
}

/** the gno.world gnome, as on the splash screen */
const GNOME = require('../../../assets/images/splash-icon.png');
const HALO = 76;

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  center: { flexGrow: 1, justifyContent: 'center', padding: space.l, paddingVertical: space.xl * 2 },
  card: {
    width: '100%', maxWidth: 400, alignSelf: 'center', backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1,
    borderRadius: 24, paddingHorizontal: space.xl, paddingTop: space.xl + space.s, paddingBottom: space.l, gap: space.l,
  },
  mark: { alignSelf: 'center', alignItems: 'center' },
  halo: {
    width: HALO, height: HALO, borderRadius: HALO / 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(61,220,132,0.12)', borderWidth: 1, borderColor: 'rgba(61,220,132,0.35)',
  },
  gnome: { width: 26, height: 44 },
  // the badge's look, overlapping the halo's bottom
  pill: { marginTop: -10, backgroundColor: colors.accent, borderRadius: radius.s, paddingHorizontal: space.s, paddingVertical: 2 },
  pillText: { color: colors.bg, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  head: { gap: space.s },
  h: { color: colors.fg, fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  t: { color: colors.muted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  tour: { gap: space.m, paddingVertical: space.m, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  tile: { width: 36, height: 36, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  rowBody: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  actions: { gap: space.xs },
  later: { alignItems: 'center', paddingVertical: space.m },
  laterText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  dim: { opacity: 0.5 },
});
