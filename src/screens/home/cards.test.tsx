import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useStore as mockUseStore } from 'zustand';

import { NO_IDENTITY } from '@/offchain/chat/identity';
import { createChatStore } from '@/offchain/chat/store';
import { line } from '@/offchain/chat/testing';
import type { Prices, Where } from '@/offchain/home';
import { ChatCard } from '@/screens/home/chat-card';
import { HereCard } from '@/screens/home/here-card';
import { PriceCard } from '@/screens/home/price-card';

let mockChat: ReturnType<typeof createChatStore>;
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/state/app-services', () => ({
  useChat: <T,>(sel: (s: ReturnType<typeof mockChat.getState>) => T) => mockUseStore(mockChat, sel),
}));

const PRICES: Prices = { now: 0.05822, change: -0.308, cap: 11487970.4, series: [[1793183280, 0.0584], [1793183340, 0.0583]] };
const WHERE: Where = { count: 18, byCountry: [{ cc: 'FR', n: 3 }, { cc: 'AU', n: 1 }], elsewhere: 2, geo: true };

describe('PriceCard', () => {
  test('shows the price, the change, the cap and the periods', async () => {
    const onDays = jest.fn();
    await render(<PriceCard data={PRICES} failed={false} days={1} onDays={onDays} />);
    for (const t of ['GNOT', '$0.0582', '−0.31%', 'cap $11.5M']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByRole('button', { name: '1d' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('button', { name: '7d' }).props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(screen.getByRole('button', { name: '7d' }));
    expect(onDays).toHaveBeenCalledWith(7);
    expect(screen.getByRole('button', { name: '30d' })).toBeTruthy();
  });

  test('without data after a failure: the site text', async () => {
    await render(<PriceCard data={null} failed days={1} onDays={jest.fn()} />);
    expect(screen.getByText('prices are busy — trying again')).toBeTruthy();
  });

  test('a failure with data keeps the price and adds a note', async () => {
    await render(<PriceCard data={PRICES} failed days={1} onDays={jest.fn()} />);
    expect(screen.getByText('$0.0582')).toBeTruthy();
    expect(screen.getByText('prices are busy — trying again')).toBeTruthy();
  });

  test('while a period loads, the card says so instead of going blank', async () => {
    await render(<PriceCard data={null} failed={false} days={30} onDays={jest.fn()} />);
    expect(screen.getByText('loading…')).toBeTruthy();
  });

  test('one point is no chart, and no prices as the site says it', async () => {
    await render(<PriceCard data={{ ...PRICES, series: [[1, 2]] }} failed={false} days={1} onDays={jest.fn()} />);
    expect(screen.queryByTestId('price-chart')).toBeNull();
    expect(screen.getByText('no prices right now')).toBeTruthy();
  });

  test('a reply without a price never shows $0', async () => {
    await render(<PriceCard data={{ now: null, change: 0, cap: 0, series: [] }} failed={false} days={1} onDays={jest.fn()} />);
    expect(screen.getByText('no prices right now')).toBeTruthy();
    expect(screen.queryByText(/^\$0/)).toBeNull();
    expect(screen.queryByText(/^cap/)).toBeNull();
  });
});

describe('HereCard', () => {
  test('the total and the table, elsewhere included', async () => {
    await render(<HereCard data={WHERE} failed={false} />);
    expect(screen.getByText('18 people')).toBeTruthy();
    expect(screen.getByText('France')).toBeTruthy();
    expect(screen.getByText('🇫🇷')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('elsewhere')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  test('countries unavailable: one unknown row with the total', async () => {
    await render(<HereCard data={{ ...WHERE, byCountry: [], elsewhere: 0, geo: false }} failed={false} />);
    expect(screen.getByText('18 people · countries unavailable on this build')).toBeTruthy();
    expect(screen.getByText('unknown')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
  });

  test('before the first answer, the card says it is loading', async () => {
    await render(<HereCard data={null} failed={false} />);
    expect(screen.getByText('loading…')).toBeTruthy();
  });

  test('nobody yet when the table is empty', async () => {
    await render(<HereCard data={{ count: 0, byCountry: [], elsewhere: 0, geo: true }} failed={false} />);
    expect(screen.getByText('nobody yet')).toBeTruthy();
  });
});

describe('ChatCard', () => {
  beforeEach(async () => {
    (router.navigate as jest.Mock).mockClear();
    mockChat = createChatStore({
      client: {} as never,
      identity: { load: async () => NO_IDENTITY, save: async () => NO_IDENTITY },
      kv: { getItem: async () => null, setItem: async () => undefined },
    });
    await mockChat.ready;
  });

  test('the last 3 lines, oldest first, with their age; a press opens Chat', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockChat.setState({
      lines: [
        line(1, { name: 'old', body: 'too old' }),
        line(2, { name: 'ann', body: 'gm', t: now - 3 * 3600 }),
        line(3, { name: 'bob', body: 'pic', att: { kind: 'image', url: '', name: '' } }),
        line(4, { name: 'cid', body: 'when gnoverse?', t: now }),
      ],
    });
    await render(<ChatCard />);
    expect(screen.queryByText('too old')).toBeNull();
    const names = screen.getAllByTestId('chat-card-name').map((n) => n.props.children);
    expect(names).toEqual(['ann', 'bob', 'cid']);
    expect(screen.getByText('3h')).toBeTruthy();
    expect(screen.getByText('📎 picture')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open chat' }));
    expect(router.navigate).toHaveBeenCalledWith('/chat');
  });

  test('before the first lines arrive, the card says it is loading', async () => {
    mockChat.setState({ phase: 'loading' });
    await render(<ChatCard />);
    expect(screen.getByText('loading…')).toBeTruthy();
    expect(screen.queryByText('nothing said yet')).toBeNull();
  });

  test('an unreachable chat says so, under the lines it still has', async () => {
    mockChat.setState({ phase: 'unreachable' });
    const view = await render(<ChatCard />);
    expect(screen.getByText('chat unreachable — retrying')).toBeTruthy();
    expect(screen.queryByText('nothing said yet')).toBeNull();
    await view.unmount();
    mockChat.setState({ phase: 'unreachable', lines: [line(1, { name: 'ann', body: 'gm' })] });
    await render(<ChatCard />);
    expect(screen.getByText('gm')).toBeTruthy();
    expect(screen.getByText('chat unreachable — retrying')).toBeTruthy();
  });

  test('an empty chat says so and still opens Chat', async () => {
    mockChat.setState({ phase: 'live' });
    await render(<ChatCard />);
    expect(screen.getByText('nothing said yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open chat' }));
    expect(router.navigate).toHaveBeenCalledWith('/chat');
  });
});
