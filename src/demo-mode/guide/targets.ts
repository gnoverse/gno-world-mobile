// Where the guide's targets are on screen, in window points. Filled by the GuideTargets on screen while the guide runs;
// in memory only.
import { createStore } from 'zustand/vanilla';

export interface Rect { x: number; y: number; w: number; h: number }

export const targetsStore = createStore<{ rects: Record<string, Rect> }>()(() => ({ rects: {} }));

const same = (a: Rect | undefined, b: Rect) => !!a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/** records where `id` is; a no-op when it has not moved */
export function placeTarget(id: string, r: Rect) {
  const { rects } = targetsStore.getState();
  if (same(rects[id], r)) return;
  targetsStore.setState({ rects: { ...rects, [id]: r } });
}

/** forgets `id`, unless another target placed it since (`r`: what this one recorded) */
export function dropTarget(id: string, r: Rect | undefined) {
  const { rects } = targetsStore.getState();
  if (!r || !same(rects[id], r)) return;
  const rest = { ...rects };
  delete rest[id];
  targetsStore.setState({ rects: rest });
}
