import type { GnoValue } from '@gnolang/gnonative';

import { gnoValueToJS } from '@/chain/api';

const gv = (o: Partial<GnoValue>) =>
  ({
    name: '', type: '', kind: '', scalar: '', data: new Uint8Array(), fields: [], elems: [], keys: [],
    objectId: '', typeId: '', offset: 0n, length: 0n, index: 0n, ...o,
  }) as GnoValue;
const time = (name: string, sec: number) =>
  gv({
    name, type: 'time.Time', kind: 'struct',
    fields: [
      gv({ name: 'sec', kind: 'number', scalar: String(sec) }), gv({ name: 'nsec', kind: 'number', scalar: '0' }),
      gv({ name: 'loc', kind: 'nil' }),
    ],
  });

test('gnoValueToJS makes plain data of structs, times, lists and pointers', () => {
  const v = gv({
    kind: 'struct',
    fields: [
      gv({ name: 'Name', kind: 'string', scalar: '🏁 speedrun' }),
      gv({ name: 'Pot', kind: 'number', scalar: '30450000' }),
      gv({ name: 'Paid', kind: 'bool', scalar: 'true' }),
      time('LastBidAt', 63926561072),
      time('PoppedAt', 0),
      gv({ name: 'History', kind: 'list', elems: [gv({ kind: 'number', scalar: '1' }), gv({ kind: 'number', scalar: '2' })] }),
      gv({ name: 'Member', kind: 'pointer', elems: [gv({ kind: 'struct', fields: [gv({ name: 'Flag', kind: 'string', scalar: 'FR' })] })] }),
      gv({ name: 'Nobody', kind: 'nil' }),
      gv({ name: 'Unexpanded', kind: 'ref', objectId: 'abc:1' }),
    ],
  });
  expect(gnoValueToJS(v)).toEqual({
    Name: '🏁 speedrun', Pot: 30450000, Paid: true, LastBidAt: 1790964272, PoppedAt: 0, History: [1, 2],
    Member: { Flag: 'FR' }, Nobody: null, Unexpanded: null,
  });
});
