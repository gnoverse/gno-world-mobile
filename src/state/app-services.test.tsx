import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import HomeRoute from '@/app/(tabs)/index';
import PoolRoute from '@/app/pool/[key]';
import { DEMO_MASTER, GUIDED_POOL_KEY } from '@/demo-mode/constants';
import { sha256Hex } from '@/demo-mode/sha256';
import { demoStore } from '@/demo-mode/store';
import { createOffchainWorld, type OffchainWorld } from '@/demo-mode/world/offchain-world';
import { keyPart } from '@/offchain/chat/identity';
import { createBookStore } from '@/offchain/sync/rooms';
import { fastCrypto, until } from '@/offchain/sync/testing';
import { PASSWORD_KEY } from '@/session/keys';
import type { ActiveSession } from '@/session/types';
import { AppServices, useServices, type Services } from '@/state/app-services';
import { settingsStore } from '@/state/settings';
import { secureStore } from '@/utils/secure';

const M = 'g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5';
const S = 'g1jyh59tr2t4yjmwajjax9mye369gkkujv7tegkk';
const REF = 'g1pvc9275lcn5suv6c0k3v0mq3xedcpfw25k50vl';
const SERVER = 'https://gno.world'; // the settings' default: the real stores' scope

// the phone's secure store, in memory
const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockSecure.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockSecure.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockSecure.delete(k)),
}));
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => jest.requireActual('node:crypto').randomBytes(n) }));
jest.mock('@/offchain/sync/expo-crypto', () => ({ expoCrypto: jest.requireActual('@/offchain/sync/testing').fastCrypto }));

// gnonative: a spy for every call the app makes on it
const mockApi = {
  activateAccount: jest.fn(async () => undefined),
  setPassword: jest.fn(async () => undefined),
  querySessionAccount: jest.fn(async () => ({
    accountInfo: { expiresAt: 0n, spendLimit: [], spendUsed: [], spendReset: 0n, spendPeriod: 0n, allowPaths: [] },
  })),
  setRemote: jest.fn(async () => undefined),
  setChainID: jest.fn(async () => undefined),
  deleteAccount: jest.fn(async () => undefined),
};
jest.mock('@gnolang/gnonative', () => ({ useGnoNativeContext: () => ({ gnonative: mockApi }) }));

// the real gno.world: a world of its own, behind the real Offchain
let mockReal: OffchainWorld;
jest.mock('@/offchain/http', () => {
  const actual = jest.requireActual('@/offchain/http');
  const { createWorldOffchain } = jest.requireActual('@/demo-mode/world/world-offchain');
  return { ...actual, createOffchain: () => createWorldOffchain(mockReal, 'real-bid') };
});

// every demo world made, to make it answer from the test
const mockWorlds: OffchainWorld[] = [];
jest.mock('@/demo-mode/world/world-offchain', () => {
  const actual = jest.requireActual('@/demo-mode/world/world-offchain');
  return {
    ...actual,
    createWorldOffchain: (w: OffchainWorld, bid: string) => {
      if (bid !== 'real-bid') mockWorlds.push(w);
      return actual.createWorldOffchain(w, bid);
    },
  };
});

const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('@/screens/pool', () => ({ PoolScreen: () => null }));
jest.mock('@/screens/home', () => ({ HomeScreen: () => null }));

// the app in the foreground: its loops run (jest's AppState mock has no state)
Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true, writable: true });

const realFetch = global.fetch;
let fetchMock: jest.Mock;

const ACTIVE: ActiveSession = { keyName: 'br-session-real', address: S, pubkey: 'pk', master: M, chainId: 'gnoland-1' };
let room: { id: string; key: string };
let nameKey: string;

beforeEach(async () => {
  fetchMock = jest.fn(async () => {
    throw new Error('no network in tests');
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  mockSecure.clear();
  mockWorlds.length = 0;
  await AsyncStorage.clear();
  settingsStore.setState({ ref: '' });

  mockReal = createOffchainWorld({
    crypto: { sha256Hex, randomBytes: (n) => fastCrypto.random(n) }, names: 'open',
    seed: (w) => void w.say({ name: 'realfriend', body: 'real hello' }),
  });
  // a real session, a reserved name and a room, as the app keeps them
  mockSecure.set(PASSWORD_KEY, 'real-password');
  await AsyncStorage.setItem('br.session', JSON.stringify({ state: { active: ACTIVE }, version: 0 }));
  nameKey = mockReal.reserve('realname', M).key;
  mockSecure.set(`br.chat.reserved.${keyPart(SERVER)}`, 'realname');
  mockSecure.set(`br.chat.namekey.${keyPart(SERVER)}`, nameKey);
  room = mockReal.makeRoom('real room', false);
  await createBookStore({ kv: AsyncStorage, secrets: secureStore, crypto: fastCrypto, scope: () => SERVER })
    .save({ rooms: [{ id: room.id, name: 'real room', key: room.key, at: 1 }], left: {} });
  jest.clearAllMocks();
});

afterEach(async () => {
  await act(() => demoStore.getState().leave());
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

let current: Services | null = null;
const seen = (s: Services) => {
  current = s;
};
function Probe() {
  const s = useServices();
  useEffect(() => seen(s), [s]);
  return null;
}
const now = () => current!;

/** `until`, saying what it waited for */
const waitFor = (what: string, f: () => boolean) =>
  until(f).catch(() => {
    throw new Error(`timed out waiting for ${what}`);
  });

/** the services once their stores have read what they keep */
async function settled(): Promise<Services> {
  const s = now();
  await waitFor('hydration', () => s.session.ready.hasHydrated());
  await act(() => Promise.all([s.chat.ready, s.identity.ready, s.homeChannels.ready, s.chatChannel.ready]).then(() => undefined));
  return s;
}

const realIsBack = async (s: Services) => {
  await waitFor('the real session', () => s.session.getState().phase === 'active');
  await waitFor('the real name', () => s.identity.getState().identity.reservedName === 'realname');
  await waitFor('the real room', () => s.rooms.getState().book.rooms.some((r) => r.id === room.id));
  await waitFor('the real chat', () => s.chat.getState().lines.some((l) => l.body === 'real hello'));
};

const bodies = (s: Services) => s.chat.getState().lines.map((l) => l.body);

test('real session, name and rooms survive a demo round trip', async () => {
  await render(<AppServices><Probe /></AppServices>);
  const real = await settled();
  expect(real.demo).toBeUndefined();
  await realIsBack(real);
  expect(real.session.getState().active).toEqual(ACTIVE);
  expect(mockApi.activateAccount).toHaveBeenCalledTimes(1); // restore() on launch

  const writes = () => [
    ...jest.mocked(AsyncStorage.setItem).mock.calls, ...jest.mocked(AsyncStorage.removeItem).mock.calls,
    ...jest.mocked(AsyncStorage.multiSet).mock.calls, ...jest.mocked(AsyncStorage.mergeItem).mock.calls,
    ...jest.mocked(SecureStore.setItemAsync).mock.calls, ...jest.mocked(SecureStore.deleteItemAsync).mock.calls,
  ].map((c) => String(c[0]));
  const gnonativeCalls = () => Object.values(mockApi).reduce((n, f) => n + f.mock.calls.length, 0);
  const before = { writes: writes(), gnonative: gnonativeCalls() };

  await act(() => demoStore.getState().enter());
  const demo = await settled();
  expect(demo).not.toBe(real);
  expect(demo.demo).toBeDefined();
  await waitFor('the demo session', () => demo.session.getState().phase === 'active');
  expect(demo.session.getState().active?.master).toBe(DEMO_MASTER);
  await waitFor('the demo chat', () => demo.chat.getState().lines.length > 0);
  expect(bodies(demo)).not.toContain('real hello');
  expect(demo.identity.getState().identity.reservedName).toBe('');
  expect(demo.rooms.getState().book.rooms.some((r) => r.id === room.id)).toBe(false);

  // nothing the demo did reached the phone's storage, gnonative or the network
  expect(writes()).toEqual(before.writes);
  expect(gnonativeCalls()).toBe(before.gnonative);
  expect(fetchMock).not.toHaveBeenCalled();

  await act(() => demoStore.getState().leave());
  const back = await settled();
  expect(back.demo).toBeUndefined();
  expect(back).not.toBe(real); // read again from the storage
  await realIsBack(back);
  expect(back.session.getState().active).toEqual(ACTIVE);
  expect(back.identity.getState().identity.nameKey).toBe(nameKey);
  expect(mockApi.activateAccount).toHaveBeenCalledTimes(2); // the real session's restore() ran again
  expect(mockApi.activateAccount).toHaveBeenLastCalledWith('br-session-real', expect.anything());
});

test('a demo answer arriving after leaving does not reach the real chat', async () => {
  await render(<AppServices><Probe /></AppServices>);
  await realIsBack(await settled());

  await act(() => demoStore.getState().enter());
  const demo = await settled();
  await waitFor('the demo chat', () => demo.chat.getState().lines.length > 0);
  // the demo chat's long poll is held open in its world
  const world = mockWorlds.at(-1)!;
  await waitFor('a demo long poll', () => world.waiting().length > 0);
  const demoLines = bodies(demo);

  await act(() => demoStore.getState().leave());
  const back = await settled();
  await realIsBack(back);
  const realLines = bodies(back);

  // the demo world answers now
  await act(async () => {
    world.say({ name: 'late', body: 'a late demo answer' });
    await new Promise((r) => setTimeout(r, 100));
  });
  expect(bodies(back)).toEqual(realLines);
  expect(bodies(back)).not.toContain('a late demo answer');
  expect(bodies(demo)).toEqual(demoLines); // the demo's stopped stores took nothing either
});

test('deep links during demo write no settings', async () => {
  await act(() => demoStore.getState().enter());
  Object.assign(mockParams, { key: GUIDED_POOL_KEY, ref: REF });
  const pool = await render(<AppServices><Probe /><PoolRoute /></AppServices>);
  expect(now().demo).toBeDefined();
  await settled();
  await pool.unmount();
  const home = await render(<AppServices><Probe /><HomeRoute /></AppServices>);
  await settled();
  await home.unmount();
  expect(settingsStore.getState().ref).toBe('');

  // the same link outside demo keeps its referrer, as before
  await act(() => demoStore.getState().leave());
  await render(<AppServices><Probe /><PoolRoute /></AppServices>);
  await settled();
  expect(settingsStore.getState().ref).toBe(REF);
});
