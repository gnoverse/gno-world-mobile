import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { roomLink } from '@/offchain/rooms/link';
import { useRooms, useServices } from '@/state/app-services';
import { useSettings } from '@/state/settings';
import { colors, radius, space } from '@/theme';

import { InviteSheet } from './invite-sheet';
import { MenuSheet, type MenuItem } from './menu-sheet';

/** The ⋯ of the Chat tab: the room's actions (the maker's need its key), and pairing. `id` '' is Public. */
export function RoomMenu({ id, visible, onClose, onLeft }: { id: string; visible: boolean; onClose(): void; onLeft(): void }) {
  const { rooms } = useServices();
  const offchainUrl = useSettings((s) => s.offchainUrl);
  const entry = useRooms((s) => s.book.rooms.find((r) => r.id === id));
  const name = useRooms((s) => s.book.rooms.find((r) => r.id === id)?.name || s.listed?.find((r) => r.id === id)?.name || 'this room');
  const key = entry?.key ?? '';
  const [listed, setListed] = useState<boolean | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviting, setInviting] = useState(false);
  // whether it is listed is the server's to say
  useEffect(() => {
    if (!visible || !key) return;
    let on = true;
    void rooms.getState().roomInfo(id).then((r) => {
      if (on && r && r !== 'gone') setListed(r.listed);
    });
    return () => {
      on = false;
    };
  }, [visible, key, id, rooms]);

  const say = (title: string, words: string) => {
    if (words) Alert.alert(title, words);
  };
  const items: MenuItem[] = [];
  if (id) {
    items.push({ label: 'Share link', onPress: () => void Share.share({ message: roomLink(offchainUrl, id) }) });
    if (key) items.push({ label: 'Invite…', onPress: () => setInviting(true) });
    items.push({ label: 'Rename', onPress: () => (setNewName(name), setRenaming(true)) });
    if (key) {
      items.push({
        label: 'Listed publicly', detail: listed === null ? undefined : listed ? 'on' : 'off',
        onPress: () =>
          void rooms.getState().setListed(id, !listed).then((err) => (err ? say('Listed publicly', err) : setListed(!listed))),
      });
      items.push({
        label: 'Delete room', danger: true,
        onPress: () =>
          Alert.alert('Delete this room for everyone? It cannot be undone.', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete room', style: 'destructive',
              onPress: async () => {
                const err = await rooms.getState().drop(id);
                if (err) say('Delete room', err);
                else onLeft();
              },
            },
          ]),
      });
    }
    items.push({ label: 'Leave', onPress: () => void rooms.getState().leave(id).then(onLeft) });
  }
  items.push({ label: 'Pair with a browser', onPress: () => router.push('/pair') });

  return (
    <>
      <MenuSheet title={id ? name : undefined} items={items} visible={visible} onClose={onClose} />
      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <View style={styles.center}>
          <View style={styles.box}>
            <Text style={styles.title}>Rename</Text>
            <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="a new name" placeholderTextColor={colors.muted} />
            <Button
              title="Save" disabled={!newName.trim()}
              onPress={async () => {
                setRenaming(false);
                say('Rename', await rooms.getState().rename(id, newName.trim()));
              }}
            />
            <Pressable accessibilityRole="button" onPress={() => setRenaming(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {key ? <InviteSheet id={id} visible={inviting} onClose={() => setInviting(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: space.xl },
  box: { backgroundColor: colors.card, borderRadius: radius.m, padding: space.l, gap: space.m },
  title: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  input: { color: colors.fg, borderColor: colors.line, borderWidth: 1, borderRadius: radius.s, padding: space.m },
  cancel: { color: colors.muted, textAlign: 'center' },
});
