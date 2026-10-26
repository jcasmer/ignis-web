import { describe, expect, it, vi } from 'vitest';

import { ApiError, createHttp } from '@/api/http';

function reply(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

const never = () => Promise.resolve(false);

describe('http client', () => {
  it('sends the access token and never the cookie by default', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { ok: true }));
    const http = createHttp({ baseUrl: '/api/v1', getToken: () => 'tok', renew: never, fetchImpl });

    await http.get('/me');

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('/api/v1/me');
    expect(headers.Authorization).toBe('Bearer tok');
    expect(init.credentials).toBe('omit');
    expect(headers['X-Ignis-CSRF']).toBeUndefined();
  });

  it('sends the cookie with the forgery header on the sign-in routes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, {}));
    const http = createHttp({ baseUrl: '', getToken: () => 'tok', renew: never, fetchImpl });

    await http.post('/auth/refresh', {}, { cookie: true, auth: false });

    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.credentials).toBe('include');
    expect(headers['X-Ignis-CSRF']).toBe('1');
    expect(headers.Authorization).toBeUndefined();
  });

  it('renews an expired token once and repeats the call', async () => {
    let token = 'old';
    const fetchImpl = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      return Promise.resolve(
        auth === 'Bearer new' ? reply(200, { n: 1 }) : reply(401, { code: 'unauthorized' }),
      );
    });
    const renew = vi.fn().mockImplementation(() => {
      token = 'new';
      return Promise.resolve(true);
    });
    const http = createHttp({ baseUrl: '', getToken: () => token, renew, fetchImpl });

    await expect(http.get('/me')).resolves.toEqual({ n: 1 });
    expect(renew).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up when the renewal fails and does not loop', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(reply(401, { code: 'unauthorized', title: 'Unauthorized' }));
    const renew = vi.fn().mockResolvedValue(false);
    const http = createHttp({ baseUrl: '', getToken: () => 'old', renew, fetchImpl });

    await expect(http.get('/me')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not try to renew a sign-in call that is rejected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(401, { code: 'unauthorized' }));
    const renew = vi.fn();
    const http = createHttp({ baseUrl: '', getToken: () => null, renew, fetchImpl });

    await expect(http.post('/auth/login', {}, { auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(renew).not.toHaveBeenCalled();
  });

  it('turns Problem Details into an ApiError and survives a body that is not JSON', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        reply(429, { code: 'too_many_attempts', title: 'Demasiados intentos' }),
      )
      .mockResolvedValueOnce(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
    const http = createHttp({ baseUrl: '', getToken: () => null, renew: never, fetchImpl });

    await expect(http.get('/x')).rejects.toMatchObject({
      status: 429,
      code: 'too_many_attempts',
      message: 'Demasiados intentos',
    });
    await expect(http.get('/x')).rejects.toMatchObject({ status: 502, code: 'error' });
  });

  it('returns undefined for 204', async () => {
    const http = createHttp({
      baseUrl: '',
      getToken: () => null,
      renew: never,
      fetchImpl: vi.fn().mockResolvedValue(reply(204)),
    });
    await expect(http.post('/auth/logout')).resolves.toBeUndefined();
  });
});

describe('http client uploads', () => {
  it('sends a FormData as it is, without forcing a JSON content type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(202, { id: 'd1' }));
    const http = createHttp({ baseUrl: '', getToken: () => 'tok', renew: never, fetchImpl });
    const form = new FormData();
    form.set('file', new Blob(['hola']), 'a.txt');

    await http.post('/knowledge/documents', form);

    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});
