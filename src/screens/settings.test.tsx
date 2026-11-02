import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { SettingsScreen } from '@/screens/settings';

jest.mock('@/state/app-services', () => ({ useSession: <T,>(sel: (s: { active: null }) => T) => sel({ active: null }) }));

test('Privacy policy opens the app policy published on berty.tech', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' }));
  expect(open).toHaveBeenCalledWith('https://berty.tech/gno-world-privacy-policy');
});
