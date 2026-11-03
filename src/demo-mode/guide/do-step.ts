// What Next does on a step that waits for an action: it opens the step's screen and does the action there, as the user
// would have, so the demo's world is where the next steps expect it (a pool booped before its clock is ended, a pot
// claimed before it is withdrawn). Each action first makes sure of the ones before it.
import type { Href } from 'expo-router';
import type { StoreApi } from 'zustand';

import { caps, parsePoolKey } from '@/chain/realms';
import { REACTIONS } from '@/offchain/chat/client';
import { isMine } from '@/offchain/chat/merge';
import type { ChatState } from '@/offchain/chat/store';
import type { Services } from '@/state/app-services';

import { DEMO_COUNTRY, DEMO_NAME, GUIDED_POOL_KEY } from '../constants';
import type { GuideEvent } from '../store';

/** what the guide says for you when it sends the hello */
export const AUTO_HELLO = 'hello from the demo 👋';
/** how long an action waits for the state it needs (a line to react to, while the chat loads) */
const WAIT_MS = 5000;

/** resolves once `ok` holds for the store's state; rejects after WAIT_MS */
const until = <S>(store: StoreApi<S>, ok: (s: S) => boolean, what: string) =>
  new Promise<S>((resolve, reject) => {
    if (ok(store.getState())) return resolve(store.getState());
    const timer = setTimeout(() => {
      off();
      reject(new Error(`the demo is still waiting for ${what}`));
    }, WAIT_MS);
    const off = store.subscribe((s) => {
      if (!ok(s)) return;
      clearTimeout(timer);
      off();
      resolve(s);
    });
  });

/** the last line of someone else */
const othersLast = (s: ChatState) => [...s.lines].reverse().find((l) => !isMine(l, s.you, s.mine));

export async function doStep(e: GuideEvent, s: Services, go: (href: Href) => void): Promise<void> {
  const k = parsePoolKey(GUIDED_POOL_KEY)!;
  const v = k.version;
  const poolHref: Href = { pathname: '/pool/[key]', params: { key: GUIDED_POOL_KEY } };
  const active = () => {
    const a = s.session.getState().active;
    if (!a) throw new Error('the demo has no session');
    return a;
  };
  const pool = () => s.game.pool(v, k.id);

  const openChat = () => {
    s.chatChannel.getState().select('');
    go('/chat');
  };
  const sayHello = async () => {
    const id = s.identity.getState();
    if (!id.identity.reservedName && !id.identity.name) await id.setName(DEMO_NAME);
    if (!(await s.chat.getState().send(AUTO_HELLO))) throw new Error(s.chat.getState().error || 'the hello was not sent');
  };
  const react = async () => {
    const c = await until(s.chat, (c) => !!othersLast(c), 'a line to react to');
    await c.react(othersLast(c)!.id, REACTIONS[0]);
  };
  const pair = async () => {
    const sync = s.sync.getState();
    if (sync.paired) return;
    const key = await sync.open(s.demo!.pairCode);
    if (!key || !(await s.sync.getState().use(key))) throw new Error('the demo browser did not pair');
  };
  // you on top of the guided pool, its clock running
  const boop = async () => {
    const p = await pool();
    if (p.over || p.cancelled || p.lastBidder === active().master) return;
    await s.game.bid(active(), p, { ref: '', flag: DEMO_COUNTRY, boost: 1, shot: 0 });
  };
  const end = async () => {
    await boop();
    if (!(await pool()).over) s.demo!.endNow(GUIDED_POOL_KEY);
  };
  const claim = async () => {
    await end();
    const p = await pool();
    if (!p.paid && p.lastBidder === active().master) await s.game.claim(active(), p);
  };
  const withdraw = async () => {
    const owed = async () => (caps(v).me ? (await s.game.me(v, active().master))?.owed ?? 0 : 0);
    if (!(await owed())) await claim();
    if (await owed()) await s.game.withdraw(active(), v);
  };

  switch (e) {
    case 'chat.sent':
      openChat();
      return sayHello();
    case 'chat.reacted':
      openChat();
      return react();
    case 'pair.paired':
      await pair();
      // the room the browser shares shows in the channels' row
      return openChat();
    case 'pool.opened':
      return go(poolHref);
    case 'pool.booped':
      go(poolHref);
      return boop();
    case 'pool.ended':
      go(poolHref);
      return end();
    case 'pool.claimed':
      go(poolHref);
      return claim();
    case 'session.withdrew':
      go('/session');
      return withdraw();
  }
}
