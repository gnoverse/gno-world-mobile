// The app's services for demo mode: the same Services the real app builds (src/state/app-services.tsx), over an
// in-memory gno.world, a simulated chain and in-memory storage. No fetch, no gnonative, nothing written to the phone.
import { GameClient } from '@/chain/game-client';
import { parsePoolKey } from '@/chain/realms';
import { expoCrypto } from '@/offchain/sync/expo-crypto';
import { hex, type CryptoBackend } from '@/offchain/sync/crypto';
import { PASSWORD_KEY } from '@/session/keys';
import { createSessionStore, type SessionState } from '@/session/store';
import type { ActiveSession } from '@/session/types';
import { createChatChannel } from '@/screens/channels/chat-channels';
import { createHomeChannels } from '@/screens/channels/home-channels';
import type { Services } from '@/state/app-services';
import { createChatServices } from '@/state/chat-services';
import { createNetworkSync } from '@/state/network-sync';

import { DemoChain } from './chain/demo-chain';
import { RealmSim } from './chain/realm-sim';
import { DEMO_MASTER, DEMO_PAIR_CODE } from './constants';
import { memoryKV, memorySecrets } from './memory';
import { sha256Hex } from './sha256';
import { fakeBrowser } from './world/fake-browser';
import { createOffchainWorld, type OffchainWorld } from './world/offchain-world';
import { seedDemoWorld } from './world/seed';
import { avatarDataUri, createWorldOffchain } from './world/world-offchain';

export interface DemoControls {
  endNow(poolKey: string): void;
  /** the simulated computer approves the pending session request (create, replace or revoke) */
  approvePending(): Promise<void>;
  pairCode: string; // DEMO_PAIR_CODE
}

const SCOPE = 'demo://gno.world';
const NETWORK = { chainId: 'gnoland-1', remote: 'demo://chain' };
const START_BALANCE = 100_000_000; // ugnot: 100 GNOT
/** the simulated chain answers at once: a short poll keeps approvals quick */
const POLL_MS = 300;
const SEEDED_KEY = 'br-session-demo';

export function createDemoServices(o: { crypto?: CryptoBackend; now?: () => number } = {}): Services {
  const crypto = o.crypto ?? expoCrypto;
  const now = o.now ?? Date.now; // ms
  const seconds = () => Math.floor(now() / 1000);
  const randomHex = (n: number) => hex(crypto.random(n));

  let world: OffchainWorld | undefined;
  const browser = (code: string) => fakeBrowser({ world: world!, crypto, now })(code);
  world = createOffchainWorld({
    crypto: { sha256Hex, randomBytes: (n) => crypto.random(n) },
    names: 'open', now: seconds, seed: seedDemoWorld, pairFallback: browser,
  });
  const offchain = createWorldOffchain(world, randomHex(8));

  const sim = new RealmSim(seconds);
  const chain = new DemoChain(sim, { now: seconds, startBalance: START_BALANCE });

  // the session demo mode starts with, in place before the store reads its storage
  const kv = memoryKV();
  const secrets = memorySecrets();
  const password = randomHex(32);
  secrets.map.set(PASSWORD_KEY, password);
  const seeded = chain.seedSessionKey(SEEDED_KEY, password);
  const active: ActiveSession = { keyName: SEEDED_KEY, ...seeded, master: DEMO_MASTER, chainId: NETWORK.chainId };
  kv.map.set('br.session', JSON.stringify({ state: { active }, version: 0 }));

  const net = createNetworkSync({
    initial: NETWORK,
    pause: () => session.getState().pause(),
    apply: async () => undefined,
    changed: async () => {
      if (session.ready.hasHydrated()) await session.getState().networkChanged();
    },
  });
  const scope = () => SCOPE;
  const { identityState, chatClient, chat, sync, rooms } = createChatServices({
    offchain, secrets, kv, crypto, scope, wallet: undefined,
  });
  const homeChannels = createHomeChannels({ kv, scope });
  const chatChannel = createChatChannel({ kv, scope });
  const session = createSessionStore({
    api: () => chain,
    secrets,
    storage: kv,
    openURL: async () => undefined, // never opens anything: wallet is false, every request goes to the "computer"
    randomHex,
    now,
    network: () => net.current(),
    wallet: false,
    pollIntervalMs: POLL_MS,
  });

  /** resolves once the request `state` is over (active, gone or failed) */
  const settled = (state: string) =>
    new Promise<void>((resolve) => {
      const done = (s: SessionState) => s.pending?.state !== state || s.phase === 'error';
      if (done(session.getState())) return resolve();
      const off = session.subscribe((s) => {
        if (!done(s)) return;
        off();
        resolve();
      });
    });

  const demo: DemoControls = {
    pairCode: DEMO_PAIR_CODE,
    endNow(poolKey) {
      const k = parsePoolKey(poolKey);
      if (!k || k.version !== 6) throw new Error(`no demo pool ${poolKey}`);
      sim.endNow(k.id);
    },
    async approvePending() {
      const p = session.getState().pending;
      if (!p) return;
      if (p.op === 'revoke') {
        chain.revoke(p.key.address);
      } else {
        const g = p.grant;
        chain.grant(p.key.address, g ? {
          spendLimit: [{ denom: 'ugnot', amount: BigInt(g.spendPerPeriod) }], spendPeriod: BigInt(g.period),
          expiresAt: BigInt(seconds() + g.expires),
        } : {});
        // a wallet's renewal revokes the old session in the same transaction
        if (p.op === 'replace' && p.old) chain.revoke(p.old.address);
      }
      // a new session asks the computer for its address; a renewal or a revocation already polls the chain
      if (!session.getState().pending?.master) await session.getState().submitMaster(DEMO_MASTER);
      await settled(p.state);
    },
  };

  return {
    api: chain, game: new GameClient(chain, () => net.current().chainId), offchain, session, net, chat,
    identity: identityState, chatClient, sync, rooms, homeChannels, chatChannel,
    avatarUri: (id) => avatarDataUri(world!, id),
    demo,
  };
}
