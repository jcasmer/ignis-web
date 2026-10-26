import { defineRouter } from '#q-app';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';

import { useSessionStore } from '@/stores/session';
import { atLeast } from '@/utils/roles';

import routes, { home, loginOf } from './routes';

export default defineRouter(({ store }) => {
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE),
  });

  const session = useSessionStore(store);
  let restoring: Promise<void> | null = null;

  router.beforeEach(async (to) => {
    // The first navigation waits for the refresh cookie to be tried, so a
    // reload of a signed-in page does not flash the sign-in.
    if (!session.ready) await (restoring ??= session.restore());

    const area = to.meta.area;
    if (!area) return true;

    if (to.meta.guest) {
      // Someone already inside has no business on the sign-in pages.
      return session.signedIn ? { path: home[session.area ?? area], replace: true } : true;
    }
    if (!session.signedIn) return { path: loginOf[area], replace: true };
    // Each area keeps to itself: a tenant user is not an operator, nor the reverse.
    if (session.area !== area) return { path: home[session.area!], replace: true };
    // A page above the user's role is not shown; the API would refuse it anyway.
    if (to.meta.minRole && !atLeast(session.tenant?.role, to.meta.minRole)) {
      return { path: home[area], replace: true };
    }
    return true;
  });

  return router;
});
