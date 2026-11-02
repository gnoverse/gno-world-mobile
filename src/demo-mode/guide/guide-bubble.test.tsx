import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { demoStore } from '../store';
import { GuideBubble } from './guide-bubble';
import { STEPS } from './steps';
import { targetsStore } from './targets';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 30, left: 0, right: 0 }) }));

const s = () => demoStore.getState();
const at = (step: number) => {
  s().enter();
  for (let i = 0; i < step; i++) s().next();
};
const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

beforeEach(() => {
  s().leave();
  targetsStore.setState({ rects: {} });
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
