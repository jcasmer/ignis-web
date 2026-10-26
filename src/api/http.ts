/**
 * The HTTP client of the console. It knows nothing of Pinia or Vue: the session
 * hands it the access token and a way to renew it, so it can be tested alone.
 *
 * Security notes:
 *  - the access token lives in memory only (it is given by `getToken`);
 *  - the refresh token is never visible here: it is an HttpOnly cookie that the
 *    browser attaches to the sign-in routes, and every call that uses it carries
 *    the `X-Ignis-CSRF` header, which another site cannot send;
 *  - an error is a Problem Details body from the API, never a raw response.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HttpOptions {
  baseUrl: string;
  /** The access token of the current session, if any. */
  getToken: () => string | null;
  /** Renews the session; true when there is a new access token. */
  renew: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  body?: unknown;
  /** Sends the refresh cookie and the forgery header (sign-in routes). */
  cookie?: boolean;
  /** Use the access token (default) or call as anonymous. */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface Http {
  get<T>(path: string, opts?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  del<T>(path: string, opts?: RequestOptions): Promise<T>;
}

interface Problem {
  code?: string;
  title?: string;
}

export function createHttp(options: HttpOptions): Http {
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function send(method: string, path: string, opts: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    const token = opts.auth === false ? null : options.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.cookie) headers['X-Ignis-CSRF'] = '1';
    return doFetch(options.baseUrl + path, {
      method,
      headers,
      ...(body !== undefined && { body }),
      ...(opts.signal && { signal: opts.signal }),
      credentials: opts.cookie ? 'include' : 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  }

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    let res = await send(method, path, opts);
    // An expired access token is renewed once, quietly, and the call is repeated.
    if (res.status === 401 && opts.auth !== false && !opts.cookie && (await options.renew())) {
      res = await send(method, path, opts);
    }
    if (!res.ok) throw await toError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    get: (path, opts) => request('GET', path, opts),
    post: (path, body, opts) => request('POST', path, { ...opts, body }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body }),
    del: (path, opts) => request('DELETE', path, opts),
  };
}

async function toError(res: Response): Promise<ApiError> {
  let problem: Problem = {};
  try {
    problem = (await res.json()) as Problem;
  } catch {
    // not JSON: keep the status only.
  }
  return new ApiError(res.status, problem.code ?? 'error', problem.title ?? res.statusText);
}
