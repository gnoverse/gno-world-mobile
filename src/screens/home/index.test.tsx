import { fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import { useStore as mockUseStore } from 'zustand';

import { NO_IDENTITY } from '@/offchain/chat/identity';
import { createChatStore } from '@/offchain/chat/store';
import { HomeScreen } from '@/screens/home';

let mockChat: ReturnType<typeof createChatStore>;
const mockGet = jest.fn(async (path: string): Promise<unknown> => {
  if (path.startsWith('/api/prices')) return { now: 0.05822, change: -0.308, cap: 11487970.4, series: [[1, 0.0584], [2, 0.0583]] };
  if (path === '/api/where') return { by_country: [{ cc: 'FR', n: 3 }], count: 18, elsewhere: 0, geo: true };
  throw new Error(`unexpected ${path}`);
});

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => mockUseEffect(cb, [cb]),
}));
jest.mock('@/state/app-services', () => ({
  useServices: () => ({ offchain: { get: mockGet }, chat: mockChat }),
  useChat: <T,>(sel: (s: ReturnType<typeof mockChat.getState>) => T) => mockUseStore(mockChat, sel),
}));

beforeEach(async () => {
  mockGet.mockClear();
  mockChat = createChatStore({
    client: {} as never,
    identity: { load: async () => NO_IDENTITY, save: async () => NO_IDENTITY },
    kv: { getItem: async () => null, setItem: async () => undefined },
  });
  await mockChat.ready;
});

test('Home shows the price, who is here and the chat; a period asks for its prices', async () => {
  await render(<HomeScreen />);
  expect(await screen.findByText('$0.0582')).toBeTruthy();
  expect(screen.getByText('18 people')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Chat/ })).toBeTruthy();
  expect(mockGet).toHaveBeenCalledWith('/api/prices?coin=gnot&days=1');
  await fireEvent.press(screen.getByRole('button', { name: '30 days' }));
  expect(mockGet).toHaveBeenCalledWith('/api/prices?coin=gnot&days=30');
});
