import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, StyleSheet, type AlertButton } from 'react-native';

import { demoStore } from '@/demo-mode/store';

import { DemoBadge } from './badge';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
let mockTop = 20;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: mockTop, bottom: 0, left: 0, right: 0 }) }));

const press = (label: string) => (_t: unknown, _m?: unknown, buttons?: AlertButton[]) => buttons?.find((b) => b.text === label)?.onPress?.();

beforeEach(() => {
  mockTop = 20;
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

test('centred in the top safe area, above the header row, small enough for it', async () => {
  demoStore.getState().enter();
  await render(<DemoBadge />);
  const row = StyleSheet.flatten(screen.getByTestId('demo-badge').props.style);
  const badge = StyleSheet.flatten(screen.getByLabelText('Demo mode — tap to leave').props.style);
  const text = StyleSheet.flatten(screen.getByText('DEMO').props.style);
  expect(badge.height).toBeLessThanOrEqual(14);
  expect(text.fontSize).toBeLessThanOrEqual(10);
  // its bottom just above the inset: the header's controls start at the inset
  expect(row).toMatchObject({ position: 'absolute', left: 0, right: 0, alignItems: 'center' });
  expect(row.top + badge.height).toBeLessThan(20);
  expect(row.top + badge.height).toBeGreaterThanOrEqual(20 - 2);
  // no inset to sit in: at the very top
  mockTop = 0;
  await render(<DemoBadge />);
  expect(StyleSheet.flatten(screen.getByTestId('demo-badge').props.style).top).toBe(0);
});
