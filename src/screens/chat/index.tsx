import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from 'zustand';

import { unreadCount } from '@/offchain/chat/merge';
import { ChannelTabs } from '@/screens/channels/channel-tabs';
import { chatRow } from '@/screens/channels/chat-channels';
import { useRoomOnScreen } from '@/screens/channels/use-room-on-screen';
import { Banner } from '@/screens/rooms/banner';
import { RoomMenu } from '@/screens/rooms/room-menu';
import { useChatChannel, useRooms, useServices, useSession } from '@/state/app-services';
import { useSettings } from '@/state/settings';

import { ChatHeader } from './chat-header';
import { ChatPane } from './chat-pane';
import { IdentitySheet } from './identity-sheet';

export function ChatScreen() {
  const { rooms, chatChannel, identity } = useServices();
  const offchainUrl = useSettings((s) => s.offchainUrl);
  const active = useSession((s) => s.active);
  const current = useChatChannel((s) => s.current);
  const book = useRooms((s) => s.book);
  const listed = useRooms((s) => s.listed);
  const gone = useRooms((s) => s.gone);
  const banner = useRooms((s) => s.banner);
  const goneSaid = useRooms((s) => s.goneSaid);
  // the row reads the scans' counts: recomputed whenever the registry changes
  useRooms((s) => s.unread);
  const store = rooms.getState().room(current);
  const here = useStore(store, (s) => s.here);
  const me = useStore(identity, (s) => s.identity);
  const publicUnread = useStore(rooms.getState().room(''), (s) => unreadCount(s, s.lastSeen, s.mine));
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const { channels, separatorAfter } = chatRow(book, listed, (id) => (id ? rooms.getState().unreadOf(id) : publicUnread));
  const channel = channels.find((c) => c.id === current);

  // `identity=1`: back from the wallet with a proof, its outcome is on the sheet
  // (Android may have rebuilt this screen, and the sheet with it, meanwhile)
  // `room=<id>`: Write in … on Home, an invitation or a link: that channel; a room not in the row is joined
  const { identity: askIdentity, room: askRoom } = useLocalSearchParams<{ identity?: string; room?: string }>();
  const [sheet, setSheet] = useState(false);
  const [asked, setAsked] = useState<string>();
  if (askIdentity !== asked) {
    setAsked(askIdentity);
    if (askIdentity === '1') setSheet(true);
  }
  // spent: the next proof asks again
  useEffect(() => {
    if (askIdentity === '1') router.setParams({ identity: undefined });
  }, [askIdentity]);
  useEffect(() => {
    if (askRoom === undefined) return;
    router.setParams({ room: undefined });
    const s = rooms.getState();
    if (!askRoom || s.book.rooms.some((r) => r.id === askRoom) || s.listed?.some((r) => r.id === askRoom)) {
      chatChannel.getState().select(askRoom);
      return;
    }
    void s.join(askRoom).then((r) => {
      if ('id' in r) chatChannel.getState().select(r.id);
      else setNotice(r.error);
    });
  }, [askRoom, rooms, chatChannel]);

  // a channel left, gone, or no longer listed: back to Public (once the listing says so, not while it loads)
  useEffect(() => {
    if (current && (gone[current] || (listed !== null && !channel))) chatChannel.getState().select('');
  }, [current, gone, listed, channel, chatChannel]);

  useFocusEffect(
    useCallback(() => {
      rooms.getState().poke();
    }, [rooms]),
  );
  useRoomOnScreen(current);

  const select = (id: string) => {
    chatChannel.getState().select(id);
    rooms.getState().open(id);
  };
  const name = channel?.name ?? 'Public';
  return (
    <View style={{ flex: 1 }}>
      <ChatHeader here={here} me={me} onOpenIdentity={() => setSheet(true)} onAdd={() => router.push('/rooms/new')} onMenu={() => setMenu(true)} />
      <ChannelTabs channels={channels} current={current} onSelect={select} separatorAfter={separatorAfter} />
      {banner ? (
        <Banner
          text={`${banner.from} opened "${banner.name}" for you`} action="Open"
          onAction={() => select(banner.id)} onDismiss={() => rooms.getState().dismissBanner()}
        />
      ) : null}
      {goneSaid ? (
        <Banner text={`"${goneSaid}" is gone — the room was quiet for a month`} onDismiss={() => rooms.getState().dismissGone()} />
      ) : null}
      {notice ? <Banner text={notice} onDismiss={() => setNotice('')} /> : null}
      {/* one per channel: a reply, an edit or a draft names lines of that room only */}
      <ChatPane
        key={current}
        store={store} identity={identity} offchainUrl={offchainUrl} onOpenIdentity={() => setSheet(true)} identityOpen={sheet}
        placeholder={`say something in ${name}`} canModerate={!!current && !!rooms.getState().keyOf(current)}
      />
      <IdentitySheet store={identity} visible={sheet} onClose={() => setSheet(false)} offchainUrl={offchainUrl} identity={active?.master ?? ''} />
      <RoomMenu id={current} visible={menu} onClose={() => setMenu(false)} onLeft={() => chatChannel.getState().select('')} />
    </View>
  );
}

