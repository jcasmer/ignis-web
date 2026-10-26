/**
 * Where the API is. In development the dev server proxies `/api` to the backend
 * (see quasar.config.ts), so the browser sees one origin; in production set
 * VITE_API_URL to the API origin, which must list this console in its
 * IGNIS_CORS_ORIGINS.
 */
const origin = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export const API_URL = `${origin}/api/v1`;
