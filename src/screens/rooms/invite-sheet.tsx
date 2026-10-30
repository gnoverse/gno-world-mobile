import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { useServices } from '@/state/app-services';
import { colors, radius, space } from '@/theme';

const TAG = /^[0-9a-f]{4}$/;

/** The maker invites someone by the name they last spoke under; the tag tells two of the same name apart. */
export function InviteSheet({ id, visible, onClose }: { id: string; visible: boolean; onClose(): void }) {
  const { rooms } = useServices();
  const [to, setTo] = useState('');
  const [tag, setTag] = useState('');
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const t = tag.trim().toLowerCase();
    if (t && !TAG.test(t)) return setSaid('a tag is four letters 0-9 and a-f');
    setBusy(true);
    setSaid(await rooms.getState().invite(id, to.trim(), t));
    setBusy(false);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessible={false} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Invite</Text>
        <TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="their name" autoCapitalize="none" placeholderTextColor={colors.muted} />
        <TextInput
          style={styles.input} value={tag} onChangeText={setTag} placeholder="tag" autoCapitalize="none" maxLength={4}
          placeholderTextColor={colors.muted}
        />
        <Text style={styles.muted}>with two bobs, add the four-letter tag</Text>
        <Button title="Invite" disabled={busy || !to.trim()} onPress={() => void send()} />
        {said ? <Text style={styles.text}>{said}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#000a' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.m, borderTopRightRadius: radius.m, padding: space.l, paddingBottom: space.xl, gap: space.m },
  title: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  input: { color: colors.fg, borderColor: colors.line, borderWidth: 1, borderRadius: radius.s, padding: space.m },
  muted: { color: colors.muted },
  text: { color: colors.fg },
});
