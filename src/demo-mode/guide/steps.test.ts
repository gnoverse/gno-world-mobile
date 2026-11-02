import { DEMO_PAIR_CODE } from '../constants';
import { GUIDE_EVENTS, GUIDE_WAITS } from '../store';
import { STEPS } from './steps';

test('11 steps, each with a title, body and at least one target', () => {
  expect(STEPS).toHaveLength(11);
  for (const s of STEPS) {
    expect(s.title.trim()).not.toBe('');
    expect(s.body.trim()).not.toBe('');
    expect(s.targets.length).toBeGreaterThan(0);
    expect(['index', 'chat', 'pools', 'session', 'settings']).toContain(s.tab);
  }
  expect(STEPS[4].body).toContain(DEMO_PAIR_CODE);
  expect(STEPS[10].targets).toEqual(['demo.badge']);
});

test('every waitFor is a GuideEvent the screens emit', () => {
  const waits = STEPS.flatMap((s) => (s.waitFor ? [s.waitFor] : []));
  expect(new Set(waits)).toEqual(new Set(GUIDE_EVENTS));
  expect(waits).toEqual([...GUIDE_EVENTS]); // once each, in order
});

test("the store's awaited events are the steps'", () => {
  expect(GUIDE_WAITS).toEqual(STEPS.map((s) => s.waitFor ?? null));
});
