import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { HomeScreen } from '@/screens/home';
import { useServices } from '@/state/app-services';
import { settingsStore } from '@/state/settings';

export default function HomeRoute() {
  // links that open the app on '/' carry the referrer
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  // a link opened in demo mode is followed, but its referrer is not kept: nothing of the demo reaches the settings
  const { demo } = useServices();
  useEffect(() => {
    if (ref && !demo) settingsStore.getState().setRefOnce(ref);
  }, [ref, demo]);
  return <HomeScreen />;
}
