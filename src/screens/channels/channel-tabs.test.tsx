import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChannelTabs, type Channel } from '@/screens/channels/channel-tabs';

const channels: Channel[] = [
  { id: '', name: 'Public', unread: 2 },
  { id: 'AAAAAAAAAAAAAAAAAAAA', name: 'Dev chat', unread: 3 },
  { id: 'BBBBBBBBBBBBBBBBBBBB', name: 'remi\'s test room with a long name', keyed: true },
];

test('each pill is a tab, the current one selected', async () => {
  await render(<ChannelTabs channels={channels} current="AAAAAAAAAAAAAAAAAAAA" onSelect={() => undefined} />);
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(3);
  expect(tabs.map((t) => t.props.accessibilityState.selected)).toEqual([false, true, false]);
});

test('the label says the unread count', async () => {
  await render(<ChannelTabs channels={channels} current="" onSelect={() => undefined} />);
  expect(screen.getByRole('tab', { name: 'Dev chat, 3 unread' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Public, 2 unread' })).toBeTruthy();
  expect(screen.getByText('3')).toBeTruthy();
});

test('a keyed room shows 🔑 and its name on one line', async () => {
  await render(<ChannelTabs channels={channels} current="" onSelect={() => undefined} />);
  const name = screen.getByText('🔑 remi\'s test room with a long name');
  expect(name.props.numberOfLines).toBe(1);
});

test('pressing a pill selects it', async () => {
  const onSelect = jest.fn();
  await render(<ChannelTabs channels={channels} current="" onSelect={onSelect} />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Dev chat, 3 unread' }));
  expect(onSelect).toHaveBeenCalledWith('AAAAAAAAAAAAAAAAAAAA');
});

test('＋ shows only with onAdd', async () => {
  const onAdd = jest.fn();
  const view = await render(<ChannelTabs channels={channels} current="" onSelect={() => undefined} />);
  expect(screen.queryByRole('button', { name: 'Add a channel' })).toBeNull();
  await view.rerender(<ChannelTabs channels={channels} current="" onSelect={() => undefined} onAdd={onAdd} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Add a channel' }));
  expect(onAdd).toHaveBeenCalled();
});

test('long-press on Public does nothing, on a room calls onLongPress', async () => {
  const onLongPress = jest.fn();
  await render(<ChannelTabs channels={channels} current="" onSelect={() => undefined} onLongPress={onLongPress} />);
  await fireEvent(screen.getByRole('tab', { name: 'Public, 2 unread' }), 'longPress');
  expect(onLongPress).not.toHaveBeenCalled();
  await fireEvent(screen.getByRole('tab', { name: 'Dev chat, 3 unread' }), 'longPress');
  expect(onLongPress).toHaveBeenCalledWith('AAAAAAAAAAAAAAAAAAAA');
});

test('the divider renders after separatorAfter', async () => {
  const view = await render(<ChannelTabs channels={channels} current="" onSelect={() => undefined} />);
  expect(screen.queryByTestId('channel-separator')).toBeNull();
  await view.rerender(<ChannelTabs channels={channels} current="" onSelect={() => undefined} separatorAfter={1} />);
  expect(screen.getByTestId('channel-separator')).toBeTruthy();
});
