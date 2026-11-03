// The app's Offchain over the in-memory world: the same contract as createOffchain (src/offchain/http.ts), no network.
import { OffchainError, type Offchain, type RequestOptions, type TextReply } from '@/offchain/http';
import { toBase64 } from '@/utils/base64url';

import type { OffchainWorld } from './offchain-world';

const enc = new TextEncoder();
const dec = new TextDecoder();

const header = (h: Record<string, string>, name: string): string => {
  const k = Object.keys(h).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? h[k] : '';
};

async function bytesOf(raw: NonNullable<RequestOptions['raw']>['body']): Promise<Uint8Array> {
  if (raw instanceof Uint8Array) return raw;
  return new Uint8Array(await raw.arrayBuffer());
}

export function createWorldOffchain(world: OffchainWorld, bid: string): Offchain {
  async function call<T>(
    method: string, path: string, body: { bytes?: Uint8Array; type?: string }, o: RequestOptions,
    read: (status: number, headers: Record<string, string>, text: string) => T,
  ): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 10000);
    const outside = () => ctrl.abort();
    if (o.signal?.aborted) ctrl.abort();
    o.signal?.addEventListener('abort', outside);
    try {
      const headers: Record<string, string> = { 'x-bid': bid };
      for (const [k, v] of Object.entries(o.headers ?? {})) headers[k.toLowerCase()] = v;
      if (body.type) headers['content-type'] = body.type;
      const reply = await world.handle({ method, path, headers, body: body.bytes, signal: ctrl.signal });
      // a long poll cut short by its signal: the real fetch would reject
      if (ctrl.signal.aborted) throw new Error('aborted');
      return read(reply.status, reply.headers, dec.decode(reply.body));
    } catch (e) {
      if (e instanceof OffchainError) throw e;
      throw new OffchainError(0, `server unreachable (${(e as Error)?.message ?? e})`);
    } finally {
      clearTimeout(timer);
      o.signal?.removeEventListener('abort', outside);
    }
  }
  async function jsonBody(body: unknown, o: RequestOptions) {
    if (o.raw) return { bytes: await bytesOf(o.raw.body), type: o.raw.contentType };
    return body !== undefined ? { bytes: enc.encode(JSON.stringify(body)), type: 'application/json' } : {};
  }
  const request = async <T>(method: string, path: string, body?: unknown, o: RequestOptions = {}): Promise<T> =>
    call(method, path, await jsonBody(body, o), o, (status, headers, text) => {
      let data: unknown = {};
      try { data = JSON.parse(text); } catch { /* not JSON */ }
      if (status < 200 || status >= 300) {
        const retry = Number(header(headers, 'Retry-After')) || undefined;
        throw new OffchainError(status, (data as { error?: string })?.error || `HTTP ${status}`, retry);
      }
      return data as T;
    });
  return {
    get: (path, o) => request('GET', path, undefined, o),
    post: (path, body, o) => request('POST', path, body, o),
    patch: (path, body, o) => request('PATCH', path, body, o),
    del: (path, o) => request('DELETE', path, undefined, o),
    exchange: (method, path, o = {}) =>
      call<TextReply>(
        method, path,
        o.text !== undefined ? { bytes: enc.encode(o.text), type: 'text/plain' }
          : o.json !== undefined ? { bytes: enc.encode(JSON.stringify(o.json)), type: 'application/json' } : {},
        o,
        (status, headers, text) => ({ status, text, etag: header(headers, 'ETag') }),
      ),
  };
}

export const avatarDataUri = (world: OffchainWorld, id: string): string => {
  const a = world.avatar(id);
  return a ? `data:${a.type};base64,${toBase64(a.bytes)}` : '';
};
