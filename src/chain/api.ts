import type { GnoValue, QEvalJSONValuesResponse, QObjectJSONValueResponse } from '@gnolang/gnonative';

export type Coin = { denom: string; amount: bigint };

export interface SessionAccountInfo {
  expiresAt: bigint;
  spendLimit: Coin[];
  spendPeriod: bigint;
  spendUsed: Coin[];
  spendReset: bigint;
  allowPaths: string[];
}

/** The part of gnonative's GnoNativeApi the dapp uses (GnoNativeApi satisfies it). */
export interface ChainApi {
  setRemote(remote: string): Promise<unknown>;
  setChainID(chainId: string): Promise<unknown>;
  render(packagePath: string, args: string): Promise<string>;
  qEvalJSONValues(packagePath: string, expression: string): Promise<QEvalJSONValuesResponse>;
  qObjectJSONValue(value: GnoValue): Promise<QObjectJSONValueResponse>;
  call(
    packagePath: string,
    fnc: string,
    args: string[],
    gasFee: string,
    gasWanted: bigint,
    signerAddress: Uint8Array,
    send?: Coin[],
  ): Promise<AsyncIterable<{ hash: Uint8Array; height: bigint }>>;
  queryAccount(address: Uint8Array): Promise<{ accountInfo?: { coins: Coin[] } }>;
  querySessionAccount(master: Uint8Array, session: Uint8Array): Promise<{ accountInfo?: SessionAccountInfo }>;
  generateRecoveryPhrase(): Promise<string>;
  createAccount(name: string, mnemonic: string, password: string): Promise<{ address: Uint8Array; pubKey: Uint8Array } | undefined>;
  activateAccount(nameOrBech32: string, master?: Uint8Array): Promise<{ hasPassword: boolean }>;
  deleteAccount(nameOrBech32: string, password: string | undefined, skipPassword: boolean): Promise<unknown>;
  setPassword(password: string, address: Uint8Array): Promise<unknown>;
  signBytes(address: Uint8Array, data: Uint8Array): Promise<{ signature: Uint8Array; pubKey: Uint8Array }>;
}

export const ugnot = (coins: Coin[] | undefined) =>
  Number((coins ?? []).filter((c) => c.denom === 'ugnot').reduce((t, c) => t + c.amount, 0n));

/** Compile-time guard: fails to typecheck if GnoNativeApi stops satisfying ChainApi. */
export const gnoNativeSatisfiesChainApi: import('@gnolang/gnonative').GnoNativeApi extends ChainApi ? true : never = true;

/** Go's time.Time counts seconds from January 1, year 1; Unix time starts this many seconds later. */
const UNIX_TO_INTERNAL = 62135596800;

/**
 * A GnoValue as plain data: a struct is an object by field name, a time.Time its Unix seconds (0 for the zero time,
 * as the realms' JSON has it), a list an array, a pointer what it points to. A kind not recognized (a ref to a stored
 * object, say) is null.
 */
export function gnoValueToJS(value: GnoValue): unknown {
  switch (value.kind) {
    case 'string':
      return value.scalar;
    case 'number':
      return Number(value.scalar);
    case 'bool':
      return value.scalar === 'true';
    case 'struct': {
      const o = gnoValuesToObject(value.fields);
      if (value.type !== 'time.Time') return o;
      return o.sec === 0 && o.nsec === 0 ? 0 : (o.sec as number) - UNIX_TO_INTERNAL;
    }
    case 'list':
      return value.elems.map(gnoValueToJS);
    case 'pointer':
      return value.elems.length > 0 ? gnoValueToJS(value.elems[0]) : null;
    default:
      return null;
  }
}

/** A struct's fields as an object by field name (see gnoValueToJS). */
export function gnoValuesToObject(values: GnoValue[]): Record<string, unknown> {
  return Object.fromEntries(values.map((v) => [v.name, gnoValueToJS(v)]));
}
