import { Alert } from 'react-native';

/** the key under which the first-launch offer is remembered (the one thing demo mode writes to the phone) */
export const DEMO_OFFERED_KEY = 'br.demo.offered';

/** Resolves true on the confirming button. */
const confirm = (title: string, message: string, yes: string) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: yes, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });

export const confirmLeave = () => confirm('Leave demo mode?', 'Everything you did here will be erased.', 'Leave');

export const confirmRestart = () =>
  confirm('Restart the demo?', 'The guide starts over and the demo goes back to its starting content.', 'Restart');
