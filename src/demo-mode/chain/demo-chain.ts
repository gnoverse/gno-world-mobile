import type { ChainApi, Coin, SessionAccountInfo } from '@/chain/api';
import { BUBBLE_REALM, REALMS, SESSION_ALLOW_PATHS, WBUBBLE_REALM, type Version } from '@/chain/realms';
import { missingPaths } from '@/session/status';
import { bytesToHex, decodeAddress, encodeAddress, encodePubKey } from '@/utils/bech32';

import { DEMO_MASTER } from '../constants';
import type { RealmSim } from './realm-sim';

const GNOT = 1_000_000;
const DAY = 86_400;
const HEX = (b: Uint8Array) => bytesToHex(b);
const TX_HASH = (n: number) => new Uint8Array(32).fill(n & 0xff);

interface Key { name: string; address: Uint8Array; pubKey: Uint8Array; password: string }

/** An offline ChainApi: the keybase, balances and sessions live in memory, the realm is a RealmSim. */
export class DemoChain implements ChainApi {
  private keys = new Map<string, Key>(); // by name
  private byPub = new Map<string, Key>(); // by address hex
  private active = new Set<string>(); // key names unlocked by setPassword
  private balances = new Map<string, bigint>(); // by address hex
  private sessions = new Map<string, SessionAccountInfo>(); // by session address hex
  private n = 0;
  private txs = 0;
  private realms = new Map<string, Version>(
    (Object.entries(REALMS) as [string, string][]).map(([v, path]) => [path, Number(v) as Version]),
  );

  constructor(private sim: RealmSim, private o: { now: () => number; startBalance: number }) {
    this.balances.set(HEX(decodeAddress(DEMO_MASTER)), BigInt(o.startBalance));
  }

  /** the simulated computer: grant the pending key to DEMO_MASTER, or revoke it */
  grant(sessionAddress: string, info: Partial<SessionAccountInfo> = {}): void {
    const t = BigInt(this.o.now());
    this.sessions.set(HEX(decodeAddress(sessionAddress)), {
      expiresAt: t + BigInt(30 * DAY), spendLimit: [{ denom: 'ugnot', amount: BigInt(5 * GNOT) }], spendPeriod: 3600n,
      spendUsed: [], spendReset: t, allowPaths: [...SESSION_ALLOW_PATHS], ...info,
    });
  }

  revoke(sessionAddress: string): void {
    this.sessions.delete(HEX(decodeAddress(sessionAddress)));
  }

  /** a key already in the keybase, unlocked, granted — for the session demo mode starts with */
  seedSessionKey(keyName: string, password: string): { address: string; pubkey: string } {
    const k = this.newKey(keyName, password);
    const t = BigInt(this.o.now());
    this.grant(encodeAddress(k.address), {
      spendLimit: [{ denom: 'ugnot', amount: BigInt(100 * GNOT) }], spendPeriod: BigInt(DAY), expiresAt: t + BigInt(30 * DAY),
    });
    return { address: encodeAddress(k.address), pubkey: encodePubKey(k.pubKey) };
  }

  private newKey(name: string, password: string): Key {
    const i = ++this.n;
    const k = {
      name, password,
      address: new Uint8Array(20).map((_, j) => (i * 53 + j * 7 + 101) & 0xff),
      pubKey: new Uint8Array(38).map((_, j) => (i * 29 + j * 3 + 17) & 0xff),
    };
    this.keys.set(name, k);
    this.byPub.set(HEX(k.address), k);
    return k;
  }

  async setRemote() {}
  async setChainID() {}

  async render(packagePath: string, args: string): Promise<string> {
    const v = this.realms.get(packagePath);
    if (v === undefined) throw new Error(`package ${packagePath} not found`);
    if (v === 6) return this.sim.renderJson(args);
    // older realms are empty in the demo
    if (args === 'json') return JSON.stringify({ now: this.o.now(), pools: [] });
    if (args.startsWith('me/')) return JSON.stringify({ addr: args.slice(3) });
    throw new Error(`pool not found in ${packagePath}`);
  }

  async call(
    packagePath: string, fnc: string, args: string[], _gasFee: string, _gasWanted: bigint, signerAddress: Uint8Array, send?: Coin[],
  ) {
    const session = this.sessions.get(HEX(signerAddress));
    if (!session) throw new Error('unknown session: the key has no session on this chain');
    const now = BigInt(this.o.now());
    if (session.expiresAt > 0n && now >= session.expiresAt) throw new Error('session expired');
    if (missingPaths(
      { expiresAt: 0, spendLimit: 0, spendUsed: 0, spendReset: 0, spendPeriod: 0, allowPaths: session.allowPaths },
      [`vm/exec:${packagePath}`],
    ).length > 0) throw new Error(`vm/exec:${packagePath} not permitted by session AllowPaths`);

    const sent = Number((send ?? []).filter((c) => c.denom === 'ugnot').reduce((t, c) => t + c.amount, 0n));
    if (send?.some((c) => c.denom !== 'ugnot')) throw new Error('only ugnot is accepted');
    const masterKey = HEX(decodeAddress(DEMO_MASTER));
    const balance = this.balances.get(masterKey) ?? 0n;
    if (balance < BigInt(sent)) throw new Error('insufficient coins');

    const used = Number(session.spendUsed.reduce((t, c) => t + c.amount, 0n));
    const limit = Number(session.spendLimit.reduce((t, c) => t + c.amount, 0n));
    let spendUsed = used;
    let spendReset = session.spendReset;
    if (session.spendPeriod > 0n && now >= session.spendReset + session.spendPeriod) {
      spendUsed = 0;
      spendReset = now;
    }
    if (sent > 0 && spendUsed + sent > limit) throw new Error('session spend limit would be exceeded');

    this.run(packagePath, fnc, args, sent);

    this.balances.set(masterKey, (this.balances.get(masterKey) ?? 0n) - BigInt(sent));
    this.sessions.set(HEX(signerAddress), {
      ...session, spendReset, spendUsed: sent > 0 ? [{ denom: 'ugnot', amount: BigInt(spendUsed + sent) }] : session.spendUsed,
    });
    const hash = TX_HASH(++this.txs);
    return (async function* () {
      yield { hash, height: BigInt(1000 + hash[0]) };
    })();
  }

  /** The realm's functions; the signer is always the master (the session spends on its behalf). */
  private run(pkg: string, fnc: string, args: string[], sent: number) {
    if (this.realms.get(pkg) !== 6 && pkg !== BUBBLE_REALM && pkg !== WBUBBLE_REALM)
      throw new Error(`package ${pkg} not found`);
    if (this.realms.get(pkg) !== 6) throw new Error(`function ${fnc} not found in ${pkg}`);
    const me = DEMO_MASTER;
    switch (fnc) {
      case 'Bid':
        return this.sim.bid(me, this.id(args[0]), args[2] ?? '', sent);
      case 'Claim':
        return this.sim.claim(me, this.id(args[0]));
      case 'Cancel':
        return this.sim.cancel(me, this.id(args[0]));
      case 'Withdraw': {
        const paid = this.sim.withdraw(me);
        const k = HEX(decodeAddress(me));
        this.balances.set(k, (this.balances.get(k) ?? 0n) + BigInt(paid));
        return;
      }
      case 'CreatePool':
        this.sim.createPool(me, args[0] ?? '', Number(args[1]), Number(args[2]), sent);
        return;
      default:
        throw new Error(`function ${fnc} not found in ${pkg}`);
    }
  }

  private id(s: string | undefined) {
    if (!/^\d+$/.test(s ?? '')) throw new Error('bad pool id');
    return Number(s);
  }

  async queryAccount(address: Uint8Array) {
    const b = this.balances.get(HEX(address));
    return { accountInfo: { coins: b === undefined ? [] : [{ denom: 'ugnot', amount: b }] } };
  }

  async querySessionAccount(master: Uint8Array, session: Uint8Array) {
    const s = this.sessions.get(HEX(session));
    if (HEX(master) !== HEX(decodeAddress(DEMO_MASTER)) || !s) throw new Error('session not found');
    return { accountInfo: s };
  }

  async generateRecoveryPhrase() {
    return `demo phrase ${++this.n}`;
  }

  async createAccount(name: string, _mnemonic: string, password: string) {
    const k = this.newKey(name, password);
    return { address: k.address, pubKey: k.pubKey };
  }

  async activateAccount(nameOrBech32: string) {
    const k = this.keys.get(nameOrBech32);
    if (!k) throw new Error(`key ${nameOrBech32} not found`);
    return { hasPassword: this.active.has(k.name) };
  }

  async deleteAccount(nameOrBech32: string) {
    const k = this.keys.get(nameOrBech32);
    if (k) {
      this.keys.delete(k.name);
      this.byPub.delete(HEX(k.address));
      this.active.delete(k.name);
    }
    return {};
  }

  async setPassword(password: string, address: Uint8Array) {
    const k = this.byPub.get(HEX(address));
    if (!k) throw new Error('key not found');
    if (k.password !== password) throw new Error('decryption failed');
    this.active.add(k.name);
  }

  async signBytes(address: Uint8Array) {
    const k = this.byPub.get(HEX(address));
    return { signature: new Uint8Array(64).fill(7), pubKey: k?.pubKey ?? new Uint8Array(38) };
  }
}
