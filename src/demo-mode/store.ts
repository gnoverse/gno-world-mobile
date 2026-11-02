// Demo mode's switch: on or off, which demo world (the epoch), and where the guide is. In memory only: an app killed
// during the demo starts again in normal mode.
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { STEPS } from './guide/steps';

export type GuideEvent =
  | 'chat.sent' | 'chat.reacted' | 'pair.paired' | 'pool.opened' | 'pool.booped' | 'pool.ended' | 'pool.claimed'
  | 'session.withdrew';

/** every event the screens emit for the guide, in the steps' order */
export const GUIDE_EVENTS: readonly GuideEvent[] = [
  'chat.sent', 'chat.reacted', 'pair.paired', 'pool.opened', 'pool.booped', 'pool.ended', 'pool.claimed', 'session.withdrew',
];

/** what each guide step waits for (null: a step to read, Next only), from the steps themselves */
export const GUIDE_WAITS: readonly (GuideEvent | null)[] = STEPS.map((st) => st.waitFor ?? null);

export interface DemoState {
  on: boolean;
  /** bumped by every switch and restart: a new set of services, a remounted tree */
  epoch: number;
  /** the guide's step; null when it is over, skipped or off */
  guideStep: number | null;
  enter(): void;
  leave(): void;
  /** a fresh demo world, the guide from the start */
  restart(): void;
  next(): void;
  skip(): void;
  /** advances when the current step waits for `e`; a no-op outside demo */
  emit(e: GuideEvent): void;
}

export const demoStore = createStore<DemoState>()((set, get) => {
  const advance = () => {
    const step = get().guideStep;
    if (step === null) return;
    set({ guideStep: step + 1 < GUIDE_WAITS.length ? step + 1 : null });
  };
  return {
    on: false,
    epoch: 0,
    guideStep: null,
    enter: () => set((s) => ({ on: true, epoch: s.epoch + 1, guideStep: 0 })),
    leave: () => set((s) => ({ on: false, epoch: s.epoch + 1, guideStep: null })),
    restart: () => {
      if (get().on) set((s) => ({ epoch: s.epoch + 1, guideStep: 0 }));
    },
    next: advance,
    skip: () => set({ guideStep: null }),
    emit: (e) => {
      const { on, guideStep } = get();
      if (on && guideStep !== null && GUIDE_WAITS[guideStep] === e) advance();
    },
  };
});

export const useDemo = <T>(sel: (s: DemoState) => T): T => useStore(demoStore, sel);
