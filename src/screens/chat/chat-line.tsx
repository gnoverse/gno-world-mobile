import * as Linking from 'expo-linking';
import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatLine } from '@/offchain/chat/types';
import { parseRoomLink } from '@/offchain/rooms/link';
import { colors, radius, space } from '@/theme';
import { flagEmoji } from '@/utils/flag';

import { ago, placeholder, pollBars, rxWho, splitLinks } from './line-model';

/** Memoised: a row renders again only when its line, its marks, the clock or a handler changes. */
export const ChatLineRow = memo(function ChatLineRow({ line, mine, now, avatarUri, myReactions, myVote, onLongPress, onJump, onReact, onVote, onRoomLink, readOnly }: {
  line: ChatLine; mine: boolean; now: number; myReactions: string[]; myVote: number | undefined;
  /** an avatar id's image URI (the server's, or the demo world's) */
  avatarUri: (id: string) => string;
  onLongPress: (l: ChatLine) => void; onJump: (id: number) => void; onReact: (l: ChatLine, emoji: string) => void;
  onVote: (l: ChatLine, opt: number) => void;
  /** given (demo mode): a gno.world room link opens that room here rather than in the browser; other links still leave */
  onRoomLink?: (id: string) => void;
  /** to read only (Home's full-screen chat): no menu, no reacting, no voting; links and the quote jump still work */
  readOnly?: boolean;
}) {
  const extra = placeholder(line);
  const [who, setWho] = useState<string | null>(null);
  const poll = line.poll ? pollBars(line.poll, myVote) : null;
  const openLink = (url: string) => {
    const room = onRoomLink ? parseRoomLink(url) : null;
    if (room) onRoomLink!(room);
    else void Linking.openURL(url);
  };
  return (
    // not one accessible element: poll options, reactions and links stay reachable on their own
    <Pressable onLongPress={readOnly ? undefined : () => onLongPress(line)} delayLongPress={300} accessible={false} style={[styles.row, mine && styles.mine]}>
      {line.av ? <Image source={{ uri: avatarUri(line.av) }} style={styles.av} /> : <View style={styles.av} />}
      <View style={styles.main}>
        {/* the row is not one accessible element: its menu is an accessibility action on the name line */}
        <Text style={styles.who} numberOfLines={1} accessible
          accessibilityLabel={`${line.name}${line.reserved ? ' ✓' : ''}, ${ago(line.t, now)}${line.edited ? ', edited' : ''}`}
          accessibilityHint={readOnly ? undefined : 'actions: reply, react, edit'}
          accessibilityActions={readOnly ? undefined : [{ name: 'menu', label: 'reply, react, edit' }, { name: 'longpress' }]}
          onAccessibilityAction={readOnly ? undefined : (e) => {
            if (e.nativeEvent.actionName === 'menu' || e.nativeEvent.actionName === 'longpress') onLongPress(line);
          }}>
          {line.bot ? '🤖' : flagEmoji(line.cc)} <Text style={styles.name}>{line.name}</Text>
          {line.reserved ? <Text style={styles.check}> ✓</Text> : null}
          <Text style={styles.meta}> ·{line.tag} {ago(line.t, now)}{line.edited ? ' · edited' : ''}</Text>
        </Text>
        {line.re ? (
          <Pressable onPress={() => onJump(line.re!.id)}>
            <Text style={styles.quote} numberOfLines={2}>↩ {line.re.name} {line.re.body || 'a line since removed'}</Text>
          </Pressable>
        ) : null}
        {poll ? (
          <View style={styles.poll}>
            <Text style={styles.body}>📊 {line.poll!.q}</Text>
            {poll.bars.map((b, i) => {
              const bar = (
                <>
                  <View style={[styles.optFill, { width: `${b.pct}%` }]} />
                  <Text style={styles.optText}>{b.label} · {b.count}{poll.total ? ` · ${b.pct}%` : ''}</Text>
                </>
              );
              const style = [styles.opt, b.mine && styles.optMine];
              return readOnly ? (
                <View key={i} style={style}>{bar}</View>
              ) : (
                <Pressable key={i} accessibilityRole="button" onPress={() => onVote(line, i)} style={style}>{bar}</Pressable>
              );
            })}
            <Text style={styles.meta}>{poll.total} vote{poll.total === 1 ? '' : 's'}</Text>
          </View>
        ) : (
          <Text style={styles.body}>
            {splitLinks(line.body).map((p, i) =>
              p.url ? <Text key={i} style={styles.link} onPress={() => openLink(p.url!)}>{p.text}</Text> : p.text)}
          </Text>
        )}
        {extra ? <Text style={styles.meta}>{extra}</Text> : null}
        {Object.keys(line.rx).length ? (
          <View style={styles.rxRow}>
            {Object.entries(line.rx).map(([e, n]) => {
              const label = `${e} ${n}${rxWho(line, e) ? `, ${rxWho(line, e)}` : ''}`;
              const style = [styles.rx, myReactions.includes(e) && styles.rxMine];
              return readOnly ? (
                <View key={e} accessible accessibilityLabel={label} style={style}>
                  <Text style={styles.rxText}>{e} {n}</Text>
                </View>
              ) : (
                <Pressable key={e} accessibilityRole="button" accessibilityLabel={label}
                  accessibilityHint="hold to see who" onPress={() => onReact(line, e)} onLongPress={() => setWho(who === e ? null : e)}
                  style={style}>
                  <Text style={styles.rxText}>{e} {n}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {who && rxWho(line, who) ? <Text style={styles.meta}>{who} {rxWho(line, who)}</Text> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.s, paddingHorizontal: space.l, paddingVertical: space.s },
  mine: { backgroundColor: colors.card },
  av: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.line },
  main: { flex: 1, gap: 2 },
  who: { color: colors.muted, fontSize: 12 },
  name: { color: colors.fg, fontWeight: '600' },
  check: { color: colors.ring },
  meta: { color: colors.muted, fontSize: 12 },
  quote: { color: colors.muted, fontSize: 12, borderLeftColor: colors.line, borderLeftWidth: 2, paddingLeft: space.s },
  body: { color: colors.fg },
  link: { color: colors.idle, textDecorationLine: 'underline' },
  poll: { gap: space.xs },
  opt: { borderColor: colors.line, borderWidth: 1, borderRadius: radius.s, overflow: 'hidden' },
  optMine: { borderColor: colors.accent },
  optFill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.line },
  optText: { color: colors.fg, padding: space.s },
  rxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  rx: { borderColor: colors.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: space.s, paddingVertical: 2 },
  rxMine: { borderColor: colors.accent },
  rxText: { color: colors.fg },
});
