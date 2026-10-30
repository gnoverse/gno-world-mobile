import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useStore as mockUseStore } from 'zustand';

import { screenServices } from '@/screens/channels/testing';
import { RoomMenu } from '@/screens/rooms/room-menu';

const A = 'AAAAAAAAAAAAAAAAAAAA';
const M = 'MMMMMMMMMMMMMMMMMMMM';
let mockS: ReturnType<typeof screenServices>;

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/state/app-services', () => ({
  useServices: () => mockS,
  useRooms: <T,>(sel: (s: ReturnType<typeof mockS.rooms.getState>) => T) => mockUseStore(mockS.rooms, sel),
}));
jest.mock('@/state/settings', () => ({ useSettings: <T,>(sel: (s: { offchainUrl: string }) => T) => sel({ offchainUrl: 'https://gno.world' }) }));

const labels = () => screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? '').filter(Boolean);
const noop = () => undefined;

beforeEach(async () => {
  mockS = screenServices({
    book: { rooms: [{ id: M, name: 'my room', key: 'k1', at: 2 }, { id: A, name: 'Dev chat', key: '', at: 1 }], left: {} },
    client: { info: async (id) => ({ id, name: 'my room', listed: true, here: 2, made: 1 }) },
  });
  await mockS.ready;
});

test('with the key: Share link, Invite…, Rename, Listed publicly, Delete room, Leave, Pair with a browser', async () => {
  await render(<RoomMenu id={M} visible onClose={noop} onLeft={noop} />);
  expect(labels()).toEqual(['Share link', 'Invite…', 'Rename', 'Listed publicly', 'Delete room', 'Leave', 'Pair with a browser']);
});

test('without it: Share link, Rename, Leave, Pair with a browser', async () => {
  await render(<RoomMenu id={A} visible onClose={noop} onLeft={noop} />);
  expect(labels()).toEqual(['Share link', 'Rename', 'Leave', 'Pair with a browser']);
});

test('Public: Pair with a browser only', async () => {
  await render(<RoomMenu id="" visible onClose={noop} onLeft={noop} />);
  expect(labels()).toEqual(['Pair with a browser']);
});

test('Delete room asks with the site\'s words, then drops the room and goes back to Public', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onLeft = jest.fn();
  await render(<RoomMenu id={M} visible onClose={noop} onLeft={onLeft} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete room' }));
  expect(alert.mock.calls[0][0]).toBe('Delete this room for everyone? It cannot be undone.');
  await act(async () => alert.mock.calls[0][2]!.find((b) => b.text === 'Delete room')!.onPress!());
  expect(mockS.book().rooms.map((r) => r.id)).toEqual([A]);
  expect(onLeft).toHaveBeenCalled();
  alert.mockRestore();
});

test('Rename without the key says it is renamed for you', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await render(<RoomMenu id={A} visible onClose={noop} onLeft={noop} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Rename' }));
  await fireEvent.changeText(screen.getByPlaceholderText('a new name'), 'ours');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(alert).toHaveBeenCalledWith('Rename', 'renamed to "ours" for you (the room\'s maker or the owner renames it for everyone)');
  expect(mockS.book().rooms.find((r) => r.id === A)?.name).toBe('ours');
  alert.mockRestore();
});

test('Leave leaves and goes back to Public', async () => {
  const onLeft = jest.fn();
  await render(<RoomMenu id={A} visible onClose={noop} onLeft={onLeft} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
  await act(async () => undefined);
  expect(mockS.book().left[A]).toBeGreaterThan(0);
  expect(onLeft).toHaveBeenCalled();
});

test('Listed publicly shows the room\'s state and flips it', async () => {
  let set: unknown;
  mockS.client.setRoom = async (_id, _k, p) => ((set = p), {});
  await render(<RoomMenu id={M} visible onClose={noop} onLeft={noop} />);
  expect(await screen.findByText('on')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Listed publicly' }));
  expect(set).toEqual({ listed: false });
});
