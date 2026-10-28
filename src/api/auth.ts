import type { Http } from './http';

/** The two areas of the console: the tenants' and the operators' (super admin). */
export type Area = 'tenant' | 'ops';

export type Step = 'mfa' | 'mfa_setup';

export type TenantRole = 'owner' | 'admin' | 'agent' | 'viewer';

export interface SessionTokens {
  access_token: string;
  expires_in: number;
  recovery_codes?: string[];
}

export interface Challenge {
  step: Step;
  challenge: string;
}

export type SignInResult = SessionTokens | Challenge;

export function isChallenge(r: SignInResult): r is Challenge {
  return 'challenge' in r;
}

export interface MfaSetup {
  secret: string;
  uri: string;
}

export interface TenantProfile {
  tenant_id: string;
  user_id?: string;
  role: TenantRole;
}

export interface OperatorProfile {
  id: string;
  email: string;
  name: string;
  role: 'super' | 'staff';
  mfa_enabled: boolean;
}

/** Where each area's sign-in lives; the paths differ, the shape does not. */
const base = { tenant: '/auth', ops: '/ops/auth' } as const;

// The operator API always answers with the cookie and rejects fields it does not know.
const asCookie = (area: Area) => (area === 'tenant' ? { cookie: true } : {});

/**
 * Calls of the sign-in. The refresh token is a cookie in both areas, so the
 * tenant sign-in asks for it explicitly (`cookie: true`); the operator one
 * always uses it.
 */
export function authApi(http: Http) {
  const cookie = { cookie: true, auth: false } as const;
  return {
    signIn: (area: Area, email: string, password: string) =>
      http.post<SignInResult>(
        `${base[area]}/login`,
        { email, password, ...asCookie(area) },
        cookie,
      ),
    verify: (area: Area, challenge: string, code: string) =>
      http.post<SessionTokens>(
        `${base[area]}/mfa/verify`,
        { challenge, code, ...asCookie(area) },
        cookie,
      ),
    setup: (area: Area, challenge: string) =>
      http.post<MfaSetup>(`${base[area]}/mfa/setup`, { challenge }, { auth: false }),
    confirm: (area: Area, challenge: string, code: string) =>
      http.post<SessionTokens>(
        `${base[area]}/mfa/confirm`,
        { challenge, code, ...asCookie(area) },
        cookie,
      ),
    refresh: (area: Area) => http.post<SessionTokens>(`${base[area]}/refresh`, {}, cookie),
    logout: (area: Area) => http.post<void>(`${base[area]}/logout`, {}, cookie),
    forgot: (area: Area, email: string) =>
      http.post<void>(`${base[area]}/password/forgot`, { email }, { auth: false }),
    reset: (area: Area, token: string, newPassword: string) =>
      http.post<void>(
        `${base[area]}/password/reset`,
        { token, new_password: newPassword },
        { auth: false },
      ),
    confirmEmail: (token: string) =>
      http.post<void>('/auth/email/confirm', { token }, { auth: false }),
    tenantProfile: () => http.get<TenantProfile>('/me'),
    operatorProfile: () => http.get<OperatorProfile>('/ops/me'),
  };
}
