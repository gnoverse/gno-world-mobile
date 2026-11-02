import AsyncStorage from '@react-native-async-storage/async-storage';

import { demoStore, GUIDE_EVENTS, GUIDE_WAITS } from './store';

const s = () => demoStore.getState();

afterEach(() => {
  s().leave();
  jest.restoreAllMocks();
});

test('starts off, with no guide', () => {
  expect(s().on).toBe(false);
  expect(s().guideStep).toBeNull();
});

test('enter and leave switch the world and the guide', () => {
  const e = s().epoch;
  s().enter();
  expect(s()).toMatchObject({ on: true, epoch: e + 1, guideStep: 0 });
  s().leave();
  expect(s()).toMatchObject({ on: false, epoch: e + 2, guideStep: null });
});

test('emit advances only the waiting step', () => {
  s().enter();
  // step 0 is read-only: no event moves it
  s().emit('chat.sent');
  expect(s().guideStep).toBe(0);
  s().next();
  s().next();
  expect(GUIDE_WAITS[2]).toBe('chat.sent');
  s().emit('chat.reacted'); // not this step's
  expect(s().guideStep).toBe(2);
  s().emit('chat.sent');
  expect(s().guideStep).toBe(3);
  s().emit('chat.sent'); // already past it
  expect(s().guideStep).toBe(3);
  s().emit('chat.reacted');
  expect(s().guideStep).toBe(4);
});

test('emit is a no-op outside demo', () => {
  s().leave();
  const before = { ...s() };
  for (const e of GUIDE_EVENTS) s().emit(e);
  expect(s()).toMatchObject({ on: false, epoch: before.epoch, guideStep: null });
});

test('next past the last step ends the guide', () => {
  s().enter();
  for (let i = 0; i < GUIDE_WAITS.length - 1; i++) s().next();
  expect(s().guideStep).toBe(GUIDE_WAITS.length - 1);
  s().next();
  expect(s()).toMatchObject({ on: true, guideStep: null });
  s().next(); // stays ended
  expect(s().guideStep).toBeNull();
});

test('skip ends the guide but stays in demo', () => {
  s().enter();
  const e = s().epoch;
  s().next();
  s().skip();
  expect(s()).toMatchObject({ on: true, epoch: e, guideStep: null });
  s().emit('chat.sent');
  expect(s().guideStep).toBeNull();
});

test('restart bumps the epoch and restarts the guide', () => {
  s().enter();
  const e = s().epoch;
  s().next();
  s().skip();
  s().restart();
  expect(s()).toMatchObject({ on: true, epoch: e + 1, guideStep: 0 });
});

test('restart outside demo does nothing', () => {
  const e = s().epoch;
  s().restart();
  expect(s()).toMatchObject({ on: false, epoch: e, guideStep: null });
});

test('nothing is persisted', () => {
  const set = jest.spyOn(AsyncStorage, 'setItem');
  const multi = jest.spyOn(AsyncStorage, 'multiSet');
  s().enter();
  s().next();
  s().emit('chat.sent');
  s().skip();
  s().restart();
  s().leave();
  expect(set).not.toHaveBeenCalled();
  expect(multi).not.toHaveBeenCalled();
  expect('persist' in demoStore).toBe(false);
});

test('every guide event, once each, in the steps order', () => {
  expect(GUIDE_EVENTS).toEqual([
    'chat.sent', 'chat.reacted', 'pair.paired', 'pool.opened', 'pool.booped', 'pool.ended', 'pool.claimed', 'session.withdrew',
  ]);
  expect(GUIDE_WAITS.filter((w) => w !== null)).toEqual(GUIDE_EVENTS);
  expect(GUIDE_WAITS).toHaveLength(11);
});
