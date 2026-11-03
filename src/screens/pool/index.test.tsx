import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import { Text as mockText } from 'react-native';

import { parsePool, type Pool } from '@/chain/parse';
import { GUIDED_POOL_KEY } from '@/demo-mode/constants';
import { demoStore, GUIDE_WAITS, type GuideEvent } from '@/demo-mode/store';
import { presenceStore, resetPresence } from '@/offchain/presence';
import { PoolScreen } from '@/screens/pool';
import { settingsStore } from '@/state/settings';

const ME = 'g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5';
const OTHER = 'g1r9mekllcz0fqdt0w2lstckw9exxtvzpqy5hazp';
const REAL_REF = 'g1c3wqq0ldvh5qt4tznwdyn0jzpzx26gfmc3l34s';
const OTHER_POOL = 'v6-4';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: unknown }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.createElement(mockText, null, children as never);
  },
  useFocusEffect: (cb: () => void | (() => void)) => mockUseEffect(cb, [cb]),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/offchain/chat/boop-report', () => ({ reportBoop: jest.fn(async () => true) }));

let mockServices: object;
const mockSession = {
  active: { master: ME, chainId: 'gnoland-1', keyName: 'k', address: ME, pubkey: '' }, status: null, refresh: async () => null,
};
jest.mock('@/state/app-services', () => ({
  useServices: () => mockServices,
  useSession: <T,>(sel: (s: object) => T) => sel(mockSession),
}));

const pool = (key: string, p: Record<string, unknown> = {}): Pool =>
  parsePool(JSON.stringify({
    id: Number(key.split('-')[1]), name: 'a bubble', creator: OTHER, window: 3600, basePrice: 1_000_000, pot: 5_000_000,
    nextPrice: 1_000_000, bids: 2, bidders: 1, lastBidder: OTHER, lastBidAt: Math.floor(Date.now() / 1000),
    deadline: Math.floor(Date.now() / 1000) + 3600, clock: 3600, ...p,
  }), 6);

/** a game whose pools are `pools`, read again after each action */
function services(pools: Record<string, Pool>, demo: boolean) {
  const game = {
    pool: jest.fn(async (_v: number, id: number) => pools[`v6-${id}`]),
    realm: jest.fn(async () => {
      throw new Error('no realm in this test');
    }),
    bid: jest.fn(async () => undefined),
    claim: jest.fn(async () => undefined),
  };
  const controls = { endNow: jest.fn() };
  mockServices = { game, chatClient: { reportBoop: jest.fn() }, demo: demo ? controls : undefined };
  return { game, controls };
}

/** the guide on the step that waits for `e` */
const guideAt = (e: GuideEvent) => {
  demoStore.getState().enter();
  demoStore.setState({ guideStep: GUIDE_WAITS.indexOf(e) });
  return GUIDE_WAITS.indexOf(e);
};

beforeEach(() => {
  settingsStore.setState({ flag: 'GB', ref: REAL_REF });
  presenceStore.setState({ country: 'FR' });
});
afterEach(() => {
  demoStore.getState().leave();
  settingsStore.setState({ flag: '', ref: '' });
  resetPresence();
});

describe("the guide's pool events come from the guided pool only", () => {
  test('a boop on another pool does not move the guide; one on the guided pool does', async () => {
    const step = guideAt('pool.booped');
    const { game } = services({ [OTHER_POOL]: pool(OTHER_POOL), [GUIDED_POOL_KEY]: pool(GUIDED_POOL_KEY) }, true);
    const view = await render(<PoolScreen poolKey={OTHER_POOL} />);
    await fireEvent.press(await screen.findByText('boop 1 GNOT'));
    await act(async () => undefined);
    expect(game.bid).toHaveBeenCalledTimes(1);
    expect(demoStore.getState().guideStep).toBe(step);
    await view.unmount();

    await render(<PoolScreen poolKey={GUIDED_POOL_KEY} />);
    await fireEvent.press(await screen.findByText('boop 1 GNOT'));
    await act(async () => undefined);
    expect(game.bid).toHaveBeenCalledTimes(2);
    expect(demoStore.getState().guideStep).toBe(step + 1);
  });

  test('End now moves the guide only once the guided pool is really over', async () => {
    const step = guideAt('pool.ended');
    // no boops: ending the clock leaves the pool open (the chain needs a boop to have a winner)
    const pools = { [GUIDED_POOL_KEY]: pool(GUIDED_POOL_KEY, { bids: 0, lastBidder: '', lastBidAt: 0 }), [OTHER_POOL]: pool(OTHER_POOL) };
    const { controls } = services(pools, true);
    const view = await render(<PoolScreen poolKey={GUIDED_POOL_KEY} />);
    await fireEvent.press(await screen.findByText('⏩ End now · demo'));
    await act(async () => undefined);
    expect(controls.endNow).toHaveBeenCalledWith(GUIDED_POOL_KEY);
    expect(demoStore.getState().guideStep).toBe(step);
    await view.unmount();

    // another pool, over after End now: still not the guide's
    const other = await render(<PoolScreen poolKey={OTHER_POOL} />);
    pools[OTHER_POOL] = pool(OTHER_POOL, { over: true });
    await fireEvent.press(await screen.findByText('⏩ End now · demo'));
    await act(async () => undefined);
    expect(demoStore.getState().guideStep).toBe(step);
    await other.unmount();

    // the guided pool with a boop: over, the guide moves on
    pools[GUIDED_POOL_KEY] = pool(GUIDED_POOL_KEY);
    await render(<PoolScreen poolKey={GUIDED_POOL_KEY} />);
    pools[GUIDED_POOL_KEY] = pool(GUIDED_POOL_KEY, { over: true });
    await fireEvent.press(await screen.findByText('⏩ End now · demo'));
    await act(async () => undefined);
    expect(demoStore.getState().guideStep).toBe(step + 1);
  });

  test('End now that fails says why and does not move the guide', async () => {
    const step = guideAt('pool.ended');
    const { controls } = services({ [GUIDED_POOL_KEY]: pool(GUIDED_POOL_KEY) }, true);
    controls.endNow.mockImplementation(() => {
      throw new Error('no demo pool v6-3');
    });
    await render(<PoolScreen poolKey={GUIDED_POOL_KEY} />);
    await fireEvent.press(await screen.findByText('⏩ End now · demo'));
    await act(async () => undefined);
    expect(screen.getByText('no demo pool v6-3')).toBeTruthy();
    expect(demoStore.getState().guideStep).toBe(step);
  });

  test('a claim on another pool does not move the guide', async () => {
    const step = guideAt('pool.claimed');
    const { game } = services({ [OTHER_POOL]: pool(OTHER_POOL, { over: true, lastBidder: ME }) }, true);
    await render(<PoolScreen poolKey={OTHER_POOL} />);
    await fireEvent.press(await screen.findByText('claim'));
    await act(async () => undefined);
    expect(game.claim).toHaveBeenCalledTimes(1);
    expect(demoStore.getState().guideStep).toBe(step);
  });
});

describe("the real settings' flag and referrer", () => {
  test('demo mode neither shows nor sends them: the demo country, no referrer', async () => {
    demoStore.getState().enter();
    const { game } = services({ [OTHER_POOL]: pool(OTHER_POOL) }, true);
    await render(<PoolScreen poolKey={OTHER_POOL} />);
    expect(await screen.findByDisplayValue('FR')).toBeTruthy();
    await fireEvent.press(screen.getByText('boop 1 GNOT'));
    await act(async () => undefined);
    expect(game.bid).toHaveBeenCalledWith(mockSession.active, expect.anything(), expect.objectContaining({ ref: '', flag: 'FR' }));
  });

  test('real mode plays under the saved flag, for the saved referrer', async () => {
    const { game } = services({ [OTHER_POOL]: pool(OTHER_POOL) }, false);
    await render(<PoolScreen poolKey={OTHER_POOL} />);
    expect(await screen.findByDisplayValue('GB')).toBeTruthy();
    await fireEvent.press(screen.getByText('boop 1 GNOT'));
    await act(async () => undefined);
    expect(game.bid).toHaveBeenCalledWith(mockSession.active, expect.anything(), expect.objectContaining({ ref: REAL_REF, flag: 'GB' }));
    settingsStore.setState({ flag: '' }); // what setFlag wrote
  });
});
