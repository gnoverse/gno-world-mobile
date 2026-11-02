import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { demoStore } from '@/demo-mode/store';
import { SettingsScreen } from '@/screens/settings';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/state/app-services', () => ({ useSession: <T,>(sel: (s: { active: null }) => T) => sel({ active: null }) }));

test('Privacy policy opens the app policy published on berty.tech', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' }));
  expect(open).toHaveBeenCalledWith('https://berty.tech/gno-world-privacy-policy');
});

test('settings hides network fields in demo', async () => {
  demoStore.getState().enter();
  await render(<SettingsScreen />);
  expect(screen.queryByText('Chain ID')).toBeNull();
  expect(screen.queryByText('Off-chain server')).toBeNull();
  expect(screen.queryByText('Save')).toBeNull();
  expect(screen.getByText('Leave demo mode')).toBeTruthy();
  expect(screen.getByText('Restart the guide')).toBeTruthy();
  expect(screen.getByText('Network and server settings are hidden in demo mode.')).toBeTruthy();
  demoStore.getState().leave();
  await render(<SettingsScreen />);
  expect(screen.getByText('Try demo mode')).toBeTruthy();
});
