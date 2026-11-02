import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { demoStore } from '@/demo-mode/store';

import { DEMO_OFFERED_KEY } from './confirm';
import { DemoOffer } from './offer-modal';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockReplace.mockClear();
  demoStore.getState().leave();
});

test('the offer shows once', async () => {
  const view = await render(<DemoOffer />);
  expect(await screen.findByText('Try gno.world in demo mode?')).toBeTruthy();
  expect(screen.getByText('Everything is simulated: nothing is sent, nothing is kept.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Not now'));
  await waitFor(async () => expect(await AsyncStorage.getItem(DEMO_OFFERED_KEY)).not.toBeNull());
  expect(screen.queryByText('Try gno.world in demo mode?')).toBeNull();
  await view.unmount();
  await render(<DemoOffer />);
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByText('Try gno.world in demo mode?')).toBeNull();
});

test('Try the demo enters demo mode', async () => {
  await render(<DemoOffer />);
  await fireEvent.press(await screen.findByText('Try the demo'));
  expect(demoStore.getState().on).toBe(true);
  expect(demoStore.getState().guideStep).toBe(0);
  expect(mockReplace).toHaveBeenCalledWith('/');
  await waitFor(async () => expect(await AsyncStorage.getItem(DEMO_OFFERED_KEY)).not.toBeNull());
});
