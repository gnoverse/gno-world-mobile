import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** The site's retry rhythm when prices are busy (priceLoad). */
export const RETRY_FIRST_MS = 4000;
export const RETRY_NEXT_MS = 20000;
export const RETRY_MAX = 8;

export interface Poll<T> {
  data: T | null;
  /** the last load failed (data, if any, is older) */
  failed: boolean;
  refresh(): Promise<void>;
}

interface Shown<T> {
  key: string;
  data: T | null;
  failed: boolean;
}

/** The timer chain, outside React: one chain at a time, and what an older chain brings back is dropped. */
function createPoller<T>(show: (s: Shown<T>) => void) {
  let load: () => Promise<T> = () => Promise.reject(new Error('not configured'));
  let everyMs = 60000;
  let key = '';
  let last: Shown<T> = { key: '', data: null, failed: false };
  let gen = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fails = 0;

  const stop = () => {
    gen++;
    clearTimeout(timer);
    timer = undefined;
  };
  const run = async (g: number) => {
    const k = key;
    let ok = false;
    try {
      const data = await load();
      if (g !== gen) return;
      ok = true;
      fails = 0;
      last = { key: k, data, failed: false };
    } catch {
      if (g !== gen) return;
      fails++;
      last = { ...last, key: k, data: last.key === k ? last.data : null, failed: true };
    }
    show(last);
    const wait = ok || fails > RETRY_MAX ? everyMs : fails === 1 ? RETRY_FIRST_MS : RETRY_NEXT_MS;
    if (fails > RETRY_MAX) fails = 0;
    timer = setTimeout(() => void run(g), wait);
  };
  const start = (k: string) => {
    stop(); // never two chains (e.g. 'active' reported twice)
    key = k;
    fails = 0;
    return run(gen);
  };
  return {
    configure(l: () => Promise<T>, ms: number) {
      load = l;
      everyMs = ms;
    },
    start,
    stop,
  };
}

/**
 * Loads now and every `everyMs` while the screen is focused and the app active. A change of `key` drops the data and
 * loads at once; a late reply for an older key is ignored.
 */
export function usePoll<T>(load: () => Promise<T>, everyMs: number, key = ''): Poll<T> {
  const [shown, setShown] = useState<Shown<T>>({ key, data: null, failed: false });
  const [poller] = useState(() => createPoller<T>(setShown));
  // before the focus effect below, so a (re)start uses this render's load
  useEffect(() => poller.configure(load, everyMs));

  useFocusEffect(
    useCallback(() => {
      if (AppState.currentState === 'active') void poller.start(key);
      const sub = AppState.addEventListener('change', (st) => (st === 'active' ? void poller.start(key) : poller.stop()));
      return () => {
        poller.stop();
        sub.remove();
      };
    }, [poller, key]), // a new key starts a new chain
  );

  const refresh = useCallback(() => poller.start(key), [poller, key]);
  // data of another key says nothing about this one
  const mine = shown.key === key;
  return { data: mine ? shown.data : null, failed: mine && shown.failed, refresh };
}
