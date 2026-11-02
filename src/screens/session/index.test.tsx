import { fireEvent, render, screen } from '@testing-library/react-native';

import { SessionScreen } from '@/screens/session';

const mockBuild = { walletEnabled: true };

jest.mock('@/session/wallet-build', () => ({
  get walletEnabled() {
    return mockBuild.walletEnabled;
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const NO_SESSION = { phase: 'none', refresh: async () => null, takeWalletError: () => undefined, begin: async () => undefined };
let mockServices: object = { api: {} };
let mockSession: object = NO_SESSION;
jest.mock('@/state/app-services', () => ({
  useServices: () => mockServices,
  useSession: <T,>(sel: (s: object) => T) => sel(mockSession),
}));

afterEach(() => {
  mockServices = { api: {} };
  mockSession = NO_SESSION;
});

test('with the wallet, a session comes from gnokey-mobile', async () => {
  mockBuild.walletEnabled = true;
  await render(<SessionScreen />);
  expect(screen.getByText('Get a session from gnokey-mobile')).toBeTruthy();
  expect(screen.queryByText('Coming soon')).toBeNull();
});

test('without the wallet, gnokey-mobile is coming soon and a session comes from a computer', async () => {
  mockBuild.walletEnabled = false;
  await render(<SessionScreen />);
  expect(screen.getByText('Coming soon')).toBeTruthy();
  expect(screen.getByText('gnokey mobile')).toBeTruthy();
  expect(screen.getByText(/coming soon to the App Store and Google Play/)).toBeTruthy();
  expect(screen.getByText('Get a session from a computer')).toBeTruthy();
  expect(screen.queryByText('Get a session from gnokey-mobile')).toBeNull();
});

test('a withdraw re-reads the account balance at once, not at the next 15 s tick', async () => {
  const GNOT = 1_000_000;
  const master = 'g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5';
  let balance = 10 * GNOT;
  let owed = 5 * GNOT;
  const queryAccount = jest.fn(async () => ({ accountInfo: { coins: [{ denom: 'ugnot', amount: BigInt(balance) }] } }));
  const me = { addr: master, referrer: '', recruits: 0, flag: '', bids: 1, paid: GNOT, divEarned: 0, refEarned: 0, won: 0, shots: 0, hits: 0, withdrawn: 0 };
  mockServices = {
    api: { queryAccount },
    game: {
      me: async (v: number) => (v === 6 ? { ...me, owed } : null),
      withdraw: async () => {
        balance += owed;
        owed = 0;
      },
    },
  };
  mockSession = {
    ...NO_SESSION, phase: 'active', active: { master, chainId: 'gnoland-1', keyName: 'k', address: master }, status: null,
  };
  jest.useFakeTimers(); // the 15 s timer never fires: only the withdraw can re-read
  try {
    await render(<SessionScreen />);
    expect(await screen.findByText('account balance 10 GNOT')).toBeTruthy();
    await fireEvent.press(await screen.findByText('withdraw 5 GNOT'));
    expect(await screen.findByText('account balance 15 GNOT')).toBeTruthy();
    expect(queryAccount).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});
