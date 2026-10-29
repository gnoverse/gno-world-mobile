import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { useNow } from '@/hooks/use-now';
import { ago, placeholder } from '@/screens/chat/line-model';
import { useChat } from '@/state/app-services';
import { colors, space } from '@/theme';

const SHOWN = 3;

export function ChatCard() {
  // the whole array, sliced here: a selector returning a new array re-renders forever under zustand 5
  const lines = useChat((s) => s.lines);
  const phase = useChat((s) => s.phase);
  const now = useNow(30000);
  const last = lines.slice(-SHOWN);
  // lines are not kept between launches: until the first poll, an empty list says nothing
  const status =
    phase === 'unreachable'
      ? 'chat unreachable — retrying'
      : last.length
        ? null
        : phase === 'live'
          ? 'nothing said yet'
          : 'loading…';
  // the button's label is all a screen reader says: the lines go in it
  const label = ['Chat', ...last.map((l) => `${l.name}: ${placeholder(l) ?? l.body}, ${ago(l.t, now)}`), status].filter(Boolean).join('. ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens the chat" onPress={() => router.navigate('/chat')}>
      {({ pressed }) => (
        <View style={pressed && styles.pressed}>
          <Card>
            <View style={styles.head}>
              <Text style={styles.label}>CHAT</Text>
              <Text style={styles.label}>›</Text>
            </View>
            {last.map((l) => (
              <View key={l.id} style={styles.line}>
                <Text testID="chat-card-name" style={styles.name} numberOfLines={1}>{l.name}</Text>
                <Text style={styles.body} numberOfLines={1}>{placeholder(l) ?? l.body}</Text>
                <Text style={styles.age}>{ago(l.t, now)}</Text>
              </View>
            ))}
            {status && <Text style={styles.age}>{status}</Text>}
          </Card>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: space.s },
  body: { color: colors.fg, flex: 1 },
  name: { color: colors.accent, fontWeight: '600', maxWidth: '40%' },
  age: { color: colors.muted, fontSize: 11 },
});
