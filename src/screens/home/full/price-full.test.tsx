import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect as mockUseEffect } from 'react';

import PriceRoute from '@/app/home/price';
import { readoutText } from '@/screens/home/format';
import { PriceFull } from '@/screens/home/full/price-full';

let mockParams: Record<string, string> = {};
const mockSetOptions = jest.fn();
let mockPrices: Record<string, unknown>;
const mockGet = jest.fn(async (path: string): Promise<unknown> => {
  if (path.startsWith('/api/prices')) return mockPrices;
  throw new Error(`unexpected ${path}`);
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => mockUseEffect(cb, [cb]),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/state/app-services', () => ({ useServices: () => ({ offchain: { get: mockGet } }) }));

beforeEach(() => {
  mockGet.mockClear();
  (router.back as jest.Mock).mockClear();
  mockParams = {};
  mockPrices = {
    now: 0.0583, change: -0.02, cap: 11503756, fdv: 77713900, supply: 1333000000,
    series: [[1, 0.06], [2, 0.0617], [3, 0.0567]], volumes: [[1, 100], [2, 0], [3, 1100]],
  };
});

test('header, figures and periods', async () => {
  await render(<PriceFull initialDays={7} />);
  expect(await screen.findByText('$0.0583')).toBeTruthy();
  for (const t of ['−0.02%', '$77.7M', '$11.5M', '1.33B GNOT', '$1.2k', '7d high', '$0.0617', '7d low', '$0.0567']) {
    expect(screen.getByText(t)).toBeTruthy();
  }
  expect(mockGet).toHaveBeenCalledWith('/api/prices?coin=gnot&days=7');
  expect(screen.getByRole('button', { name: '7 days' }).props.accessibilityState).toMatchObject({ selected: true });
  await fireEvent.press(screen.getByRole('button', { name: '30 days' }));
  expect(mockGet).toHaveBeenCalledWith('/api/prices?coin=gnot&days=30');
});

test('an unknown days param opens on 1 day', async () => {
  mockParams = { days: 'abc' };
  await render(<PriceRoute />);
  expect(await screen.findByText('$0.0583')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledWith('/api/prices?coin=gnot&days=1');
});

test('the route opens on the period it is given', async () => {
  mockParams = { days: '30' };
  await render(<PriceRoute />);
  expect(await screen.findByText('$0.0583')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledWith('/api/prices?coin=gnot&days=30');
});

test('✕ closes', async () => {
  await render(<PriceFull initialDays={1} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(router.back).toHaveBeenCalled();
});

test('a figure the server does not give is not shown', async () => {
  mockPrices = { ...mockPrices, fdv: 0, supply: 0 };
  await render(<PriceFull initialDays={1} />);
  expect(await screen.findByText('$0.0583')).toBeTruthy();
  expect(screen.queryByText('fdv')).toBeNull();
  expect(screen.queryByText('supply')).toBeNull();
  expect(screen.getByText('market cap')).toBeTruthy();
});

test('the volume bars: one stroke per point that traded', async () => {
  await render(<PriceFull initialDays={1} />);
  expect(await screen.findByText('$0.0583')).toBeTruthy();
  await fireEvent(screen.getByTestId('full-chart'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } } });
  expect(screen.getByTestId('vol-bars').props.d.match(/M/g)).toHaveLength(2);
});

test('hold and slide on the chart: the moment is read out, and the sheet stays put meanwhile', async () => {
  jest.useFakeTimers();
  try {
    await render(<PriceFull initialDays={1} />);
    expect(await screen.findByText('$0.0583')).toBeTruthy();
    const chart = screen.getByTestId('full-chart');
    await fireEvent(chart, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } } });
    const at = (x: number) => ({ nativeEvent: { locationX: x, locationY: 100, pageX: x, pageY: 100 } });
    mockSetOptions.mockClear();
    await fireEvent(chart, 'responderGrant', at(150));
    await act(async () => void jest.advanceTimersByTime(200));
    await fireEvent(chart, 'responderMove', at(0));
    expect(screen.getByText(readoutText(1, 0.06, 100))).toBeTruthy();
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    await fireEvent(chart, 'responderRelease', at(0));
    expect(screen.queryByText(readoutText(1, 0.06, 100))).toBeNull();
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
  } finally {
    jest.useRealTimers();
  }
});
