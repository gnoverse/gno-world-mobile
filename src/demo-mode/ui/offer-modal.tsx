import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useSettingsHydrated } from '@/state/settings';
import { colors, radius, space } from '@/theme';

import { demoStore } from '../store';
import { DEMO_OFFERED_KEY } from './confirm';

/** The offer itself: Settings opens it too. `onClose` runs after either button. */
export function DemoOfferDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.h}>Try gno.world in demo mode?</Text>
          <Text style={styles.t}>Everything is simulated: nothing is sent, nothing is kept.</Text>
          <Button
            title="Try the demo"
            onPress={() => {
              onClose();
              demoStore.getState().enter();
              router.replace('/');
            }}
          />
          <Button kind="secondary" title="Not now" onPress={onClose} />
        </View>
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

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.l },
  card: { backgroundColor: colors.bg, borderColor: colors.line, borderWidth: 1, borderRadius: radius.m, padding: space.l, gap: space.m },
  h: { color: colors.fg, fontSize: 18, fontWeight: '800' },
  t: { color: colors.fg },
});
