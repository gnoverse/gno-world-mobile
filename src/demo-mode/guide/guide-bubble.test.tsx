import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Platform, StyleSheet } from 'react-native';

import { space } from '@/theme';

import { demoStore } from '../store';
import { GuideBubble } from './guide-bubble';
import { STEPS } from './steps';
import { targetsStore } from './targets';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 30, left: 0, right: 0 }) }));
// the route shown: a tab (the tab bar visible) unless a test says otherwise
let mockSegments: string[] = ['(tabs)'];
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useSegments: () => mockSegments, router: { navigate: (h: unknown) => mockNavigate(h) } }));
const mockServices = { demo: {} };
jest.mock('@/state/app-services', () => ({ useServices: () => mockServices }));
// what Next does on a step that waits for an action (do-step.test.ts tests the actions themselves)
const mockDoStep = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('./do-step', () => ({ doStep: (...a: unknown[]) => mockDoStep(...a) }));

const s = () => demoStore.getState();
const at = (step: number) => {
  s().enter();
  for (let i = 0; i < step; i++) s().next();
};
const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

beforeEach(() => {
  mockDoStep.mockReset();
  mockDoStep.mockImplementation(async () => undefined);
  mockNavigate.mockClear();
  s().leave();
  targetsStore.setState({ rects: {} });
  mockSegments = ['(tabs)'];
});

test('points at the first mounted target', async () => {
  at(4); // Pair with a browser: pair.input, else chat.menu
  targetsStore.setState({ rects: { 'chat.menu': { x: 300, y: 40, w: 30, h: 30 }, 'pair.input': { x: 20, y: 200, w: 200, h: 40 } } });
  await render(<GuideBubble />);
  expect(screen.getByText(STEPS[4].title)).toBeTruthy();
  expect(screen.getByText(STEPS[4].body)).toBeTruthy();
  // the dot sits on pair.input's centre (a 14 pt dot)
  expect(style('guide-dot')).toMatchObject({ left: 20 + 100 - 7, top: 200 + 20 - 7 });
  // in the top half: the bubble below it
  expect(style('guide-bubble')).toMatchObject({ top: 240 + 10 });
});

test('a target in the bottom half gets the bubble above it', async () => {
  at(0);
  const { height } = Dimensions.get('window');
  targetsStore.setState({ rects: { 'home.price': { x: 0, y: height - 200, w: 300, h: 100 } } });
  await render(<GuideBubble />);
  expect(style('guide-bubble')).toMatchObject({ bottom: 200 + 10 });
});

test('falls back to the tab', async () => {
  at(4);
  await render(<GuideBubble />);
  expect(screen.getByText('Open Chat to continue.')).toBeTruthy();
  expect(screen.queryByText(STEPS[4].body)).toBeNull();
  // and points at the tab once it is measured
  await render(<GuideBubble />);
  targetsStore.setState({ rects: { 'tab.chat': { x: 100, y: 1200, w: 60, h: 50 } } });
  expect(await screen.findByTestId('guide-dot')).toBeTruthy();
  expect(style('guide-dot')).toMatchObject({ left: 100 + 30 - 7, top: 1200 + 25 - 7 });
});

test('on a screen without the tab bar, never points at a tab', async () => {
  at(9); // Your winnings: session.withdraw, tab session; seen from the pool just claimed
  mockSegments = ['pool', '[key]'];
  // the tabs stay mounted under the pushed screen: a tab's place may still be known
  targetsStore.setState({ rects: { 'tab.session': { x: 200, y: 1200, w: 60, h: 50 } } });
  await render(<GuideBubble />);
  expect(screen.getByText('Go back, then open Session.')).toBeTruthy();
  expect(screen.queryByText('Open Session to continue.')).toBeNull();
  expect(screen.queryByTestId('guide-dot')).toBeNull();
  // placed as with nothing to point at, without the tab bar's room
  expect(style('guide-bubble')).toMatchObject({ bottom: 30 + space.s });
});

test("a step's way in, when its targets are not on screen, is pointed at", async () => {
  at(6); // Boop: pool.boop, via pools.guided; seen from the Pools list
  mockSegments = ['(tabs)', 'pools'];
  targetsStore.setState({
    rects: { 'pools.guided': { x: 40, y: 300, w: 100, h: 100 }, 'tab.pools': { x: 200, y: 1200, w: 60, h: 50 } },
  });
  await render(<GuideBubble />);
  expect(screen.getByText('Open this pool to continue.')).toBeTruthy();
  expect(style('guide-dot')).toMatchObject({ left: 40 + 50 - 7, top: 300 + 50 - 7 });
});

test('a step with a way in not on screen still points at its tab', async () => {
  at(7); // Skip the wait, seen from Chat
  mockSegments = ['(tabs)', 'chat'];
  targetsStore.setState({ rects: { 'tab.pools': { x: 200, y: 1200, w: 60, h: 50 } } });
  await render(<GuideBubble />);
  expect(screen.getByText('Open Pools to continue.')).toBeTruthy();
  expect(style('guide-dot')).toMatchObject({ left: 200 + 30 - 7, top: 1200 + 25 - 7 });
});

test('Next and Skip drive the store', async () => {
  at(0);
  await render(<GuideBubble />);
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(s().guideStep).toBe(1);
  expect(screen.getByText(STEPS[1].title)).toBeTruthy();
  // a step that waits for an action still has Next
  s().next();
  expect(s().guideStep).toBe(2);
  expect(await screen.findByRole('button', { name: 'Next' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(s()).toMatchObject({ on: true, guideStep: null });
  expect(screen.queryByText(STEPS[2].title)).toBeNull();
});

test("Next on a step that waits for an action does it, on the step's screen, then moves on", async () => {
  at(6); // Boop
  await render(<GuideBubble />);
  let finish!: () => void;
  mockDoStep.mockImplementation(() => new Promise<undefined>((r) => (finish = () => r(undefined))));
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(mockDoStep).toHaveBeenCalledWith('pool.booped', mockServices, expect.any(Function));
  // the step stays, and Next waits, while the action runs
  expect(s().guideStep).toBe(6);
  expect(screen.getByRole('button', { name: 'Next' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  expect(screen.getByTestId('guide-next-spinner')).toBeTruthy();
  // its navigation goes through the router
  (mockDoStep.mock.calls[0][2] as (h: string) => void)('/session');
  expect(mockNavigate).toHaveBeenCalledWith('/session');
  await act(async () => finish());
  expect(s().guideStep).toBe(7);
  expect(screen.queryByTestId('guide-next-spinner')).toBeNull();
});

test('Next on a step to read does no action', async () => {
  at(0);
  await render(<GuideBubble />);
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(mockDoStep).not.toHaveBeenCalled();
  expect(s().guideStep).toBe(1);
});

test('an action that moved the guide itself is not moved twice; one that failed still moves on', async () => {
  at(5); // Pools: opening the pool says so
  await render(<GuideBubble />);
  mockDoStep.mockImplementation(async () => {
    s().emit('pool.opened');
    return undefined;
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(s().guideStep).toBe(6);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  mockDoStep.mockImplementation(async () => {
    throw new Error('no');
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(s().guideStep).toBe(7);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test('Done on the last step ends the guide', async () => {
  at(10);
  await render(<GuideBubble />);
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(s()).toMatchObject({ on: true, guideStep: null });
});

test('renders nothing when demo is off', async () => {
  targetsStore.setState({ rects: { 'home.price': { x: 0, y: 100, w: 300, h: 100 } } });
  await render(<GuideBubble />);
  expect(screen.toJSON()).toBeNull();
  // nor once the guide is over
  at(0);
  s().skip();
  await render(<GuideBubble />);
  expect(screen.toJSON()).toBeNull();
});

describe('VoiceOver', () => {
  let announce: jest.SpyInstance;
  let os: jest.ReplaceProperty<typeof Platform.OS>;
  beforeEach(() => {
    // react-native's jest setup makes it a mock already, which the earlier tests called
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    announce.mockClear();
    os = jest.replaceProperty(Platform, 'OS', 'ios');
  });
  afterEach(() => {
    announce.mockRestore();
    os.restore();
  });

  test("hears the step's title and body when the step or its body changes, not on every render", async () => {
    at(0);
    const price = { 'home.price': { x: 0, y: 100, w: 300, h: 100 } };
    targetsStore.setState({ rects: price });
    await render(<GuideBubble />);
    expect(announce.mock.calls).toEqual([[`${STEPS[0].title}. ${STEPS[0].body}`]]);
    // the target moves: same words, nothing said again
    await act(() => targetsStore.setState({ rects: { 'home.price': { x: 0, y: 120, w: 300, h: 100 } } }));
    expect(announce).toHaveBeenCalledTimes(1);
    // the target leaves the screen: the body says where to go
    await act(() => targetsStore.setState({ rects: {} }));
    expect(announce).toHaveBeenLastCalledWith(`${STEPS[0].title}. Open Home to continue.`);
    // the next step
    await act(() => s().next());
    expect(announce).toHaveBeenLastCalledWith(`${STEPS[1].title}. Open Home to continue.`);
    expect(announce).toHaveBeenCalledTimes(3);
  });

  test('nothing is said outside the guide, nor on Android (its live region speaks)', async () => {
    await render(<GuideBubble />);
    expect(announce).not.toHaveBeenCalled();
    os.replaceValue('android');
    at(0);
    await render(<GuideBubble />);
    expect(announce).not.toHaveBeenCalled();
  });
});
