import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/theme';

export interface MenuItem { label: string; onPress(): void; danger?: boolean; detail?: string }

/** A bottom sheet of actions, closed by a tap outside it or after an action. */
export function MenuSheet({ title, items, visible, onClose }: { title?: string; items: MenuItem[]; visible: boolean; onClose(): void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <View style={styles.sheet}>
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
          {items.map((it) => (
            <Pressable
              key={it.label} accessibilityRole="button" accessibilityLabel={it.label} style={styles.item}
              onPress={() => {
                onClose();
                it.onPress();
              }}>
              <Text style={[styles.label, it.danger && { color: colors.bad }]}>{it.label}</Text>
              {it.detail ? <Text style={styles.detail}>{it.detail}</Text> : null}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.m, borderTopRightRadius: radius.m, padding: space.l, paddingBottom: space.xl, gap: space.xs },
  title: { color: colors.fg, fontWeight: '700', marginBottom: space.s },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.m, borderBottomColor: colors.line, borderBottomWidth: 1 },
  label: { color: colors.fg, fontSize: 16 },
  detail: { color: colors.muted },
});
