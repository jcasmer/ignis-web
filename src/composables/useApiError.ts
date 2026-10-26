import { useI18n } from 'vue-i18n';

import { ApiError } from '@/api/http';

/**
 * Turns whatever failed into a sentence for the person. The server's own text is
 * never shown: it may be technical, and what is shown must be in the user's
 * language and say what to do.
 */
export function useApiError() {
  const { t } = useI18n();

  return function describe(
    err: unknown,
    context: 'login' | 'code' | 'password' | 'other' = 'other',
  ): string {
    if (!(err instanceof ApiError)) return t('auth.errors.network');
    if (err.status === 429) return t('auth.errors.locked');
    if (err.status === 401)
      return context === 'code' ? t('auth.errors.invalidCode') : t('auth.errors.invalid');
    if (err.status === 400 && context === 'password') return t('auth.errors.weakPassword');
    return t('auth.errors.generic');
  };
}
