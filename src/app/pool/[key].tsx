import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { PoolScreen } from '@/screens/pool';
import { useServices } from '@/state/app-services';
import { settingsStore } from '@/state/settings';

export default function PoolRoute() {
  const { key, ref } = useLocalSearchParams<{ key: string; ref?: string }>();
  // a link opened in demo mode is followed, but its referrer is not kept: nothing of the demo reaches the settings
  const { demo } = useServices();
  useEffect(() => {
    if (ref && !demo) settingsStore.getState().setRefOnce(ref);
  }, [ref, demo]);
  // keyed: another pool starts from a clean screen, not from the previous one's state
  return <PoolScreen key={key} poolKey={key} />;
}
