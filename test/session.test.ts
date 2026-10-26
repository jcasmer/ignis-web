import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@/stores/session';

type Handler = (init: RequestInit, body: Record<string, unknown>) => Response;

/** A fake API: routes by "METHOD path". Returns the list of calls made. */
function fakeApi(routes: Record<string, Handler>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const key = `${init.method ?? 'GET'} ${url.replace('/api/v1', '')}`;
      calls.push(key);
      const handler = routes[key];
      if (!handler)
        return Promise.resolve(
          new Response(JSON.stringify({ code: 'not_found' }), { status: 404 }),
        );
      const body =
        typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      return Promise.resolve(handler(init, body));
    }),
  );
  return calls;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const tokens = { access_token: 'access-1', expires_in: 900 };
const bearer = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

describe('session store', () => {
  it('opens the session at once when the account has no second factor', async () => {
    fakeApi({
      'POST /auth/login': () => json(200, tokens),
      'GET /me': () => json(200, { tenant_id: 't1', role: 'owner' }),
    });
    const s = useSessionStore();

    expect(await s.signIn('tenant', 'a@b.co', 'x')).toBe('session');
    expect(s.signedIn).toBe(true);
    expect(s.role).toBe('owner');
  });

  it('holds only a challenge after the password when a code is needed', async () => {
    fakeApi({ 'POST /auth/login': () => json(200, { step: 'mfa', challenge: 'c1' }) });
    const s = useSessionStore();

    expect(await s.signIn('tenant', 'a@b.co', 'x')).toBe('mfa');
    expect(s.signedIn).toBe(false);
    expect(s.step).toBe('mfa');
  });

  it('finishes with the code and drops the challenge', async () => {
    fakeApi({
      'POST /auth/login': () => json(200, { step: 'mfa', challenge: 'c1' }),
      'POST /auth/mfa/verify': (_i, body) =>
        body.code === '123456' ? json(200, tokens) : json(401, { code: 'unauthorized' }),
      'GET /me': () => json(200, { tenant_id: 't1', role: 'admin' }),
    });
    const s = useSessionStore();
    await s.signIn('tenant', 'a@b.co', 'x');

    await expect(s.verify('000000')).rejects.toMatchObject({ status: 401 });
    expect(s.signedIn).toBe(false);
    await s.verify('123456');
    expect(s.signedIn).toBe(true);
    expect(s.step).toBeNull();
  });

  it('keeps the recovery codes of an enrollment until they are dismissed', async () => {
    fakeApi({
      'POST /ops/auth/login': () => json(200, { step: 'mfa_setup', challenge: 'c1' }),
      'POST /ops/auth/mfa/setup': () => json(200, { secret: 'S', uri: 'otpauth://totp/x' }),
      'POST /ops/auth/mfa/confirm': () => json(200, { ...tokens, recovery_codes: ['aaaaa-bbbbb'] }),
      'GET /ops/me': () =>
        json(200, { id: 'o1', email: 'a@b.co', name: 'Ana', role: 'super', mfa_enabled: true }),
    });
    const s = useSessionStore();

    expect(await s.signIn('ops', 'a@b.co', 'x')).toBe('mfa_setup');
    expect((await s.beginSetup()).secret).toBe('S');
    await s.confirmSetup('123456');
    expect(s.recoveryCodes).toEqual(['aaaaa-bbbbb']);
    expect(s.area).toBe('ops');
    s.dismissRecoveryCodes();
    expect(s.recoveryCodes).toBeNull();
  });

  it('never sends the cookie flag to the operator API, which rejects unknown fields', async () => {
    let seen: Record<string, unknown> = {};
    fakeApi({
      'POST /ops/auth/login': (_i, body) => {
        seen = body;
        return json(200, { step: 'mfa', challenge: 'c' });
      },
    });
    await useSessionStore().signIn('ops', 'a@b.co', 'x');
    expect(seen).toEqual({ email: 'a@b.co', password: 'x' });
  });

  it('ends the local session on logout even if the server fails', async () => {
    fakeApi({
      'POST /auth/login': () => json(200, tokens),
      'GET /me': () => json(200, { tenant_id: 't1', role: 'viewer' }),
      'POST /auth/logout': () => json(500, { code: 'internal' }),
    });
    const s = useSessionStore();
    await s.signIn('tenant', 'a@b.co', 'x');

    await s.logout();

    expect(s.signedIn).toBe(false);
    expect(s.tenant).toBeNull();
  });

  it('renews with one request however many calls found the token expired', async () => {
    let valid = 'access-1';
    const calls = fakeApi({
      'POST /auth/login': () => json(200, tokens),
      'GET /me': (init) =>
        bearer(init) === `Bearer ${valid}`
          ? json(200, { tenant_id: 't1', role: 'owner' })
          : json(401, { code: 'unauthorized' }),
      'POST /auth/refresh': () => {
        valid = 'access-2';
        return json(200, { access_token: 'access-2', expires_in: 900 });
      },
    });
    const s = useSessionStore();
    await s.signIn('tenant', 'a@b.co', 'x');
    valid = 'something-else'; // the server no longer accepts access-1.

    await expect(
      Promise.all([s.api.tenantProfile(), s.api.tenantProfile(), s.api.tenantProfile()]),
    ).resolves.toHaveLength(3);

    expect(calls.filter((c) => c === 'POST /auth/refresh')).toHaveLength(1);
  });

  it('clears the session when the renewal is refused', async () => {
    fakeApi({
      'POST /auth/login': () => json(200, tokens),
      'GET /me': () => json(401, { code: 'unauthorized' }),
      'POST /auth/refresh': () => json(401, { code: 'unauthorized' }),
    });
    const s = useSessionStore();

    await expect(s.signIn('tenant', 'a@b.co', 'x')).rejects.toBeDefined();

    expect(s.signedIn).toBe(false);
  });
});
