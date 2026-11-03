import { roomLink } from '@/offchain/rooms/link';

import type { WorldSeedApi } from './offchain-world';

/** The demo world's content: invented names and lines, a listed room and an unlisted one whose link is in Public. */
export function seedDemoWorld(w: WorldSeedApi): { listedRoom: string; inviteRoom: string } {
  w.say({ name: 'mika', body: 'morning, bubbles' });
  const hello = w.say({ name: 'sol', body: 'anyone up for a quick game?', rx: { '🔥': ['mika', 'rune'] } });
  w.say({ name: 'rune', body: 'count me in', replyTo: hello });
  w.say({ name: 'mika', body: 'which pool today?', poll: { q: 'Which pool today?', opts: ['Small', 'Medium', 'Large'], votes: [1, 3, 2] } });
  w.say({ name: 'rune', body: 'the medium one is lively right now' });

  const listed = w.makeRoom('Night owls', true);
  w.say({ name: 'rune', body: 'still awake?', room: listed.id });
  w.say({ name: 'mika', body: 'always', room: listed.id });
  w.say({ name: 'sol', body: 'one more round, then sleep', room: listed.id });

  const invite = w.makeRoom('Bubble talk', false);
  w.say({ name: 'sol', body: `join us: ${roomLink('https://gno.world', invite.id)}` });
  return { listedRoom: listed.id, inviteRoom: invite.id };
}
