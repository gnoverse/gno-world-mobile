import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import type { Me } from '@/chain/parse';
import { caps, VERSIONS, type Version } from '@/chain/realms';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { GuideTarget } from '@/demo-mode/guide/guide-target';
import { demoStore } from '@/demo-mode/store';
import { txMessage } from '@/screens/pool/tx-message';
import { createTxRunner } from '@/screens/pool/tx-runner';
import type { ActiveSession } from '@/session/types';
import { useServices } from '@/state/app-services';
import { colors, space } from '@/theme';
import { gnot } from '@/utils/gnot';

export function Earnings({ session }: { session: ActiveSession }) {
  const { game } = useServices();
  const [mes, setMes] = useState<Partial<Record<Version, Me>>>({});
  const [failed, setFailed] = useState<Version[]>([]); // versions whose earnings could not be read
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    const out: Partial<Record<Version, Me>> = {};
    const lost: Version[] = [];
    await Promise.all(VERSIONS.filter((v) => caps(v).me).map(async (v) => {
      const m = await game.me(v, session.master).catch(() => undefined);
      if (m === undefined) lost.push(v);
      else if (m && (m.bids || m.owed || m.won)) out[v] = m;
    }));
    if (!mounted.current) return;
    setMes(out);
    setFailed(VERSIONS.filter((v) => lost.includes(v)));
  }, [game, session.master]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // One withdraw at a time; the buttons stay disabled until the earnings are reloaded.
  const [runner] = useState(() => createTxRunner(setBusy)); // setBusy after unmount is a no-op

  const rows = VERSIONS.filter((v) => mes[v]);
  // the withdraw the demo's guide points at: the first one
  const guided = rows.find((v) => caps(v).withdraw && mes[v]!.owed > 0);
  return (
    <Card>
      <Text style={{ color: colors.fg, fontWeight: '700' }}>Your earnings</Text>
      {!rows.length && !failed.length ? <Text style={{ color: colors.muted }}>No boops yet.</Text> : null}
      {failed.length ? (
        <>
          <Text style={{ color: colors.accent }}>Could not load your earnings on {failed.map((v) => `v${v}`).join(', ')}.</Text>
          <Button kind="secondary" title="Try again" disabled={busy} onPress={() => void load()} />
        </>
      ) : null}
      {rows.map((v) => {
        const m = mes[v]!;
        const withdraw = caps(v).withdraw && m.owed > 0 ? (
          <Button
            title={`withdraw ${gnot(m.owed)}`}
            disabled={busy}
            onPress={() =>
              void runner(async () => {
                try {
                  await game.withdraw(session, v);
                  demoStore.getState().emit('session.withdrew');
                  if (mounted.current) setMsg(`withdrew ${gnot(m.owed)}`);
                } catch (e) {
                  if (mounted.current) setMsg(txMessage(e, Math.floor(Date.now() / 1000)));
                }
              }, load)
            }
          />
        ) : null;
        return (
          <View key={v} style={{ gap: space.xs }}>
            <Text style={{ color: colors.fg }}>
              v{v} · {m.bids} boops · put in {gnot(m.paid)} · dividends {gnot(m.divEarned)} · invites {gnot(m.refEarned)} · won {gnot(m.won)}
            </Text>
            {v === guided ? <GuideTarget id="session.withdraw">{withdraw}</GuideTarget> : withdraw}
          </View>
        );
      })}
      {msg ? <Text style={{ color: colors.fg }}>{msg}</Text> : null}
    </Card>
  );
}
