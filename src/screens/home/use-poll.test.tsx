import { act, renderHook } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { usePoll } from '@/screens/home/use-poll';

// focus = mounted: the callback runs in an effect and its cleanup on unmount
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => mockUseEffect(cb, [cb]),
}));

let appListener: (s: AppStateStatus) => void;
beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, l) => {
    appListener = l as (s: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => jest.useRealTimers());

const tick = (ms: number) => act(async () => void jest.advanceTimersByTime(ms));

test('loads at once, then every everyMs', async () => {
  const load = jest.fn(async () => 'a');
  const { result } = await renderHook(() => usePoll(load, 20000));
  expect(load).toHaveBeenCalledTimes(1);
  expect(result.current.data).toBe('a');
  await tick(20000);
  expect(load).toHaveBeenCalledTimes(2);
});

test('keeps the last data and sets failed on an error', async () => {
  const load = jest.fn<Promise<string>, []>().mockResolvedValueOnce('a').mockRejectedValueOnce(new Error('busy')).mockResolvedValue('b');
  const { result } = await renderHook(() => usePoll(load, 20000));
  expect(result.current).toMatchObject({ data: 'a', failed: false });
  await tick(20000);
  expect(result.current).toMatchObject({ data: 'a', failed: true });
  await tick(4000);
  expect(result.current).toMatchObject({ data: 'b', failed: false });
});

test('retries 4 s then 20 s, 8 times, then the normal interval', async () => {
  const load = jest.fn(async () => {
    throw new Error('busy');
  });
  await renderHook(() => usePoll(load, 300000));
  expect(load).toHaveBeenCalledTimes(1);
  await tick(4000);
  expect(load).toHaveBeenCalledTimes(2);
  for (let i = 3; i <= 9; i++) {
    await tick(20000);
    expect(load).toHaveBeenCalledTimes(i);
  }
  await tick(299999);
  expect(load).toHaveBeenCalledTimes(9);
  await tick(1);
  expect(load).toHaveBeenCalledTimes(10);
});

test('a new key drops the data and ignores the late reply of the old key', async () => {
  const pending: Record<string, (v: string) => void> = {};
  const { result, rerender } = await renderHook(
    ({ k }: { k: string }) => usePoll(() => new Promise<string>((r) => (pending[k] = r)), 300000, k),
    { initialProps: { k: '1' } },
  );
  await act(async () => pending['1']('first'));
  expect(result.current.data).toBe('first');
  await rerender({ k: '7' });
  expect(result.current.data).toBeNull();
  const old = pending['1'];
  await rerender({ k: '1' });
  await rerender({ k: '7' }); // a second load of '7' is now the one that counts
  await act(async () => old('old'));
  expect(result.current.data).toBeNull();
  await act(async () => pending['7']('new'));
  expect(result.current.data).toBe('new');
});

test('stops in the background and on unmount, starts again when active', async () => {
  const load = jest.fn(async () => 'a');
  const { unmount } = await renderHook(() => usePoll(load, 20000));
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => appListener('background'));
  await tick(60000);
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => appListener('active'));
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => appListener('active')); // reported twice: still one chain
  await tick(20000);
  expect(load).toHaveBeenCalledTimes(4);
  await unmount();
  await tick(60000);
  expect(load).toHaveBeenCalledTimes(4);
});

test('refresh loads now and resolves when done', async () => {
  const load = jest.fn<Promise<string>, []>().mockResolvedValueOnce('a').mockResolvedValue('b');
  const { result } = await renderHook(() => usePoll(load, 300000));
  await act(() => result.current.refresh());
  expect(load).toHaveBeenCalledTimes(2);
  expect(result.current.data).toBe('b');
});
