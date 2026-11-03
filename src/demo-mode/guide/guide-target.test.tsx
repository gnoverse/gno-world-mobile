import { act, render, screen } from '@testing-library/react-native';
import { NavigationContext } from 'expo-router/react-navigation';
import { isRenderingComponent } from 'expo-router/build/react-navigation/core/isRenderingComponent';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { demoStore } from '../store';
import { GuideTarget } from './guide-target';
import { targetsStore } from './targets';

const s = () => demoStore.getState();
const rects = () => targetsStore.getState().rects;

beforeEach(() => {
  s().leave();
  targetsStore.setState({ rects: {} });
  // the jest View measures nothing: say where it is
  jest.spyOn(View.prototype as unknown as { measureInWindow(cb: (...n: number[]) => void): void }, 'measureInWindow')
    .mockImplementation((cb) => cb(10, 20, 30, 40));
});
afterEach(() => jest.restoreAllMocks());

test('outside demo mode, only its children', async () => {
  await render(<GuideTarget id="home.price"><Text>card</Text></GuideTarget>);
  expect(screen.toJSON()).toMatchObject({ type: 'Text' });
  expect(rects()).toEqual({});
});

test("records where it is while the step wants it, forgets it after", async () => {
  s().enter(); // step 1: home.price, tab index
  await render(
    <>
      <GuideTarget id="home.price"><Text>price</Text></GuideTarget>
      <GuideTarget id="home.here"><Text>here</Text></GuideTarget>
      <GuideTarget id="tab.index"><Text>Home</Text></GuideTarget>
    </>,
  );
  // the step's target and its tab; not the others
  expect(rects()).toEqual({ 'home.price': { x: 10, y: 20, w: 30, h: 40 }, 'tab.index': { x: 10, y: 20, w: 30, h: 40 } });
  await act(() => s().next()); // step 2: home.here
  expect(Object.keys(rects()).sort()).toEqual(['home.here', 'tab.index']);
  await act(() => s().skip());
  expect(rects()).toEqual({});
});

test("records the step's way in too", async () => {
  s().enter();
  for (let i = 0; i < 6; i++) s().next(); // Boop: pool.boop, via pools.guided
  await render(<GuideTarget id="pools.guided"><Text>pool</Text></GuideTarget>);
  expect(Object.keys(rects())).toEqual(['pools.guided']);
});

test('unmounting forgets it', async () => {
  s().enter();
  await render(<GuideTarget id="home.price"><Text>price</Text></GuideTarget>);
  expect(Object.keys(rects())).toEqual(['home.price']);
  await screen.unmount();
  expect(rects()).toEqual({});
});

/** a screen's navigation, as React Navigation gives it; it counts the times it is asked while React renders, which
 *  React Navigation warns about (a stale answer) */
function fakeScreen(focused: boolean) {
  const subs: Record<string, Set<() => void>> = { focus: new Set(), blur: new Set() };
  const nav = {
    focused, askedInRender: 0,
    isFocused() {
      if (isRenderingComponent()) nav.askedInRender++;
      return nav.focused;
    },
    addListener(type: 'focus' | 'blur', cb: () => void) {
      subs[type].add(cb);
      return () => subs[type].delete(cb);
    },
    async go(to: boolean) {
      nav.focused = to;
      await act(() => subs[to ? 'focus' : 'blur'].forEach((cb) => cb()));
    },
  };
  const In = ({ children }: { children: ReactNode }) => <NavigationContext.Provider value={nav as never}>{children}</NavigationContext.Provider>;
  return { nav, In };
}

test('in a screen not shown, it waits until the screen is shown, and is forgotten when it is left', async () => {
  s().enter();
  const { nav, In } = fakeScreen(false);
  await render(<In><GuideTarget id="home.price"><Text>price</Text></GuideTarget></In>);
  expect(rects()).toEqual({});
  await nav.go(true);
  expect(Object.keys(rects())).toEqual(['home.price']);
  await nav.go(false);
  expect(rects()).toEqual({});
  expect(nav.askedInRender).toBe(0);
});

test("a tab button sits in its own tab's navigation: it is measured whichever tab is shown", async () => {
  s().enter();
  for (let i = 0; i < 2; i++) s().next(); // Say hello, seen from Home: its tab is Chat's
  const { nav, In } = fakeScreen(false);
  await render(<In><GuideTarget id="tab.chat" anyScreen><Text>Chat</Text></GuideTarget></In>);
  expect(Object.keys(rects())).toEqual(['tab.chat']);
  expect(nav.askedInRender).toBe(0);
});
