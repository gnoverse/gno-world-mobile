import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect as mockUseEffect } from 'react';

import { presenceStore } from '@/offchain/presence';
import { PoolsScreen } from '@/screens/pools';

let mockActive: object | null = null;
const mockServices = { game: { allPools: async () => ({ pools: [], realms: { 6: {} }, failed: [] }), teams: async () => ({}) } };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => mockUseEffect(cb, [cb]),
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/state/app-services', () => ({
  useServices: () => mockServices,
  useSession: <T,>(sel: (s: { active: object | null }) => T) => sel({ active: mockActive }),
}));

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  jest.mocked(router.navigate).mockClear();
  presenceStore.getState().update({ country: 'FR' });
});

test('without a session, New pool is disabled and Go to Session navigates there', async () => {
  mockActive = null;
  await render(<PoolsScreen />);
  const button = screen.getByRole('button', { name: 'New pool' });
  expect(button.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(button);
  expect(router.push).not.toHaveBeenCalled();
  expect(screen.getByText('A session lets this phone play. Start one to create a pool.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Go to Session ›' }));
  expect(router.navigate).toHaveBeenCalledWith('/session');
});

test('with a session, New pool opens the form and no hint shows', async () => {
  mockActive = { master: 'g1x' };
  await render(<PoolsScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'New pool' }));
  expect(router.push).toHaveBeenCalledWith('/create');
  expect(screen.queryByText('Go to Session ›')).toBeNull();
});

test('a blocked country shows only the no-play text', async () => {
  mockActive = null;
  presenceStore.getState().update({ country: 'US' });
  await render(<PoolsScreen />);
  expect(screen.getByText(/play is not offered/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'New pool' })).toBeNull();
  expect(screen.queryByText('Go to Session ›')).toBeNull();
});
