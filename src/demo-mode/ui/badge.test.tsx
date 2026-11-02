import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { demoStore } from '@/demo-mode/store';

import { DemoBadge } from './badge';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) }));

const press = (label: string) => (_t: unknown, _m?: unknown, buttons?: AlertButton[]) => buttons?.find((b) => b.text === label)?.onPress?.();

beforeEach(() => {
  mockReplace.mockClear();
  demoStore.getState().leave();
});
afterEach(() => jest.restoreAllMocks());

test('no badge outside demo mode', async () => {
  await render(<DemoBadge />);
  expect(screen.queryByText('DEMO')).toBeNull();
});

test('leaving asks first', async () => {
  demoStore.getState().enter();
  await render(<DemoBadge />);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(press('Cancel'));
  await fireEvent.press(screen.getByLabelText('Demo mode — tap to leave'));
  expect(alert).toHaveBeenCalledWith('Leave demo mode?', 'Everything you did here will be erased.', expect.any(Array), expect.anything());
  expect(demoStore.getState().on).toBe(true);
  expect(mockReplace).not.toHaveBeenCalled();
  alert.mockImplementation(press('Leave'));
  await fireEvent.press(screen.getByLabelText('Demo mode — tap to leave'));
  await new Promise((r) => setTimeout(r, 0));
  expect(demoStore.getState().on).toBe(false);
  expect(mockReplace).toHaveBeenCalledWith('/');
});
