// The guide's steps, in order: what each says, what it points at, and the action that moves it on by itself. The one
// source of the steps' count and of what each waits for (the store reads it).
import { DEMO_PAIR_CODE } from '../constants';
import type { GuideEvent } from '../store';

export type GuideTab = 'index' | 'chat' | 'pools' | 'session' | 'settings';

export interface GuideStep {
  title: string;
  body: string;
  /** the GuideTarget ids pointed at, the first one on screen wins */
  targets: string[];
  /** where the targets live: with none on screen, the bubble points at this tab */
  tab: GuideTab;
  /** the action that ends the step (Next still shows) */
  waitFor?: GuideEvent;
}

/** the tab bar's words for each tab */
export const TAB_LABELS: Record<GuideTab, string> = { index: 'Home', chat: 'Chat', pools: 'Pools', session: 'Session', settings: 'Settings' };

export const STEPS: GuideStep[] = [
  { targets: ['home.price'], tab: 'index', title: 'GNOT price', body: 'The price of GNOT, the coin every boop is paid in. Tap the card for the chart.' },
  { targets: ['home.here'], tab: 'index', title: 'Here now', body: 'Who is on gno.world right now, and from where.' },
  { targets: ['chat.composer'], tab: 'chat', waitFor: 'chat.sent', title: 'Say hello', body: 'Write a message and send it. In demo mode, only you see it.' },
  { targets: ['chat.line'], tab: 'chat', waitFor: 'chat.reacted', title: 'React', body: 'Long-press a message to react to it.' },
  {
    targets: ['pair.input', 'chat.menu'], tab: 'chat', waitFor: 'pair.paired', title: 'Pair with a browser',
    body: `Open the menu, then Pair with a browser. Type the code shown on gno.world — here, ${DEMO_PAIR_CODE}. Your name and rooms come over.`,
  },
  { targets: ['pools.guided'], tab: 'pools', waitFor: 'pool.opened', title: 'Pools', body: 'Each bubble is a pool. Open this one.' },
  {
    targets: ['pool.boop'], tab: 'pools', waitFor: 'pool.booped', title: 'Boop',
    body: 'Every boop feeds the pot and restarts the clock. If nobody boops after you, you win.',
  },
  { targets: ['pool.endNow'], tab: 'pools', waitFor: 'pool.ended', title: 'Skip the wait', body: 'In demo mode, end the clock now.' },
  { targets: ['pool.claim'], tab: 'pools', waitFor: 'pool.claimed', title: 'You won', body: 'Claim the pot: your share is credited to you.' },
  { targets: ['session.withdraw'], tab: 'session', waitFor: 'session.withdrew', title: 'Your winnings', body: 'Withdraw them to your balance.' },
  { targets: ['demo.badge'], tab: 'index', title: "That's the tour", body: 'Explore freely. Tap DEMO whenever you want to leave.' },
];
