import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import {
  authApi,
  isChallenge,
  type Area,
  type MfaSetup,
  type OperatorProfile,
  type SessionTokens,
  type Step,
  type TenantProfile,
} from '@/api/auth';
import { ApiError, createHttp } from '@/api/http';
import { opsApi } from '@/api/ops';
import { tenantApi } from '@/api/tenant';
import { API_URL } from '@/config';

/** Which area was last used. Not a secret: it only says where to try renewing. */
const AREA_HINT = 'ignis-area';

export type SignInOutcome = 'session' | Step;

/**
 * The session of the console.
 *
 * The access token is held here, in memory, and nowhere else: not in
 * localStorage, not in sessionStorage, not in the URL. Reloading the page loses
 * it, and `restore` gets a new one from the refresh cookie, which the page can
 * not read. The pending sign-in (the challenge between password and code) is
 * memory too, so a reload starts again from the password.
 */
export const useSessionStore = defineStore('session', () => {
  const area = ref<Area | null>(null);
  const accessToken = shallowRef<string | null>(null);
  const tenant = ref<TenantProfile | null>(null);
  const operator = ref<OperatorProfile | null>(null);
  const ready = ref(false);

  const pendingArea = ref<Area | null>(null);
  const challenge = ref<string | null>(null);
  const step = ref<Step | null>(null);
  /** Recovery codes of an enrollment, shown once and then dropped. */
  const recoveryCodes = ref<string[] | null>(null);

  const signedIn = computed(() => accessToken.value !== null && area.value !== null);
  const role = computed(
    () => (area.value === 'ops' ? operator.value?.role : tenant.value?.role) ?? null,
  );

  let renewing: Promise<boolean> | null = null;

  const http = createHttp({
    baseUrl: API_URL,
    getToken: () => accessToken.value,
    renew: () => renew(),
  });
  const api = authApi(http);
  const data = tenantApi(http);
  const ops = opsApi(http);

  function rememberArea(a: Area | null) {
    try {
      if (a) localStorage.setItem(AREA_HINT, a);
      else localStorage.removeItem(AREA_HINT);
    } catch {
      // storage can be blocked; the session still works.
    }
  }

  function forget() {
    accessToken.value = null;
    tenant.value = null;
    operator.value = null;
    area.value = null;
    clearPending();
  }

  function clearPending() {
    pendingArea.value = null;
    challenge.value = null;
    step.value = null;
  }

  async function loadProfile(a: Area) {
    if (a === 'ops') operator.value = await api.operatorProfile();
    else tenant.value = await api.tenantProfile();
  }

  async function open(a: Area, tokens: SessionTokens) {
    accessToken.value = tokens.access_token;
    area.value = a;
    await loadProfile(a);
    rememberArea(a);
    clearPending();
  }

  /** One renewal at a time, however many calls found the token expired. */
  function renew(): Promise<boolean> {
    const current = area.value;
    if (!current) return Promise.resolve(false);
    renewing ??= (async () => {
      try {
        accessToken.value = (await api.refresh(current)).access_token;
        return true;
      } catch {
        forget();
        return false;
      } finally {
        renewing = null;
      }
    })();
    return renewing;
  }

  /** On start: a returning user has a refresh cookie and gets a session from it. */
  async function restore() {
    let hint: string | null = null;
    try {
      hint = localStorage.getItem(AREA_HINT);
    } catch {
      // ignore.
    }
    if (hint === 'tenant' || hint === 'ops') {
      try {
        const tokens = await api.refresh(hint);
        await open(hint, tokens);
      } catch {
        forget();
        rememberArea(null);
      }
    }
    ready.value = true;
  }

  async function signIn(a: Area, email: string, password: string): Promise<SignInOutcome> {
    const res = await api.signIn(a, email, password);
    if (isChallenge(res)) {
      pendingArea.value = a;
      challenge.value = res.challenge;
      step.value = res.step;
      return res.step;
    }
    await open(a, res);
    return 'session';
  }

  function pending(): { area: Area; challenge: string } {
    if (!pendingArea.value || !challenge.value)
      throw new ApiError(401, 'no_challenge', 'No hay un ingreso en curso');
    return { area: pendingArea.value, challenge: challenge.value };
  }

  async function verify(code: string) {
    const p = pending();
    await open(p.area, await api.verify(p.area, p.challenge, code));
  }

  function beginSetup(): Promise<MfaSetup> {
    const p = pending();
    return api.setup(p.area, p.challenge);
  }

  async function confirmSetup(code: string) {
    const p = pending();
    const tokens = await api.confirm(p.area, p.challenge, code);
    recoveryCodes.value = tokens.recovery_codes ?? [];
    await open(p.area, tokens);
  }

  function dismissRecoveryCodes() {
    recoveryCodes.value = null;
  }

  async function logout() {
    const current = area.value;
    try {
      if (current) await api.logout(current);
    } catch {
      // the local session ends either way.
    }
    forget();
    rememberArea(null);
  }

  return {
    area,
    tenant,
    operator,
    ready,
    signedIn,
    role,
    step,
    pendingArea,
    recoveryCodes,
    api,
    data,
    ops,
    http,
    restore,
    signIn,
    verify,
    beginSetup,
    confirmSetup,
    dismissRecoveryCodes,
    logout,
  };
});
