import type { RouteRecordRaw } from 'vue-router';

import type { Area, TenantRole } from '@/api/auth';

declare module 'vue-router' {
  interface RouteMeta {
    /** The area the page belongs to: who may see it. */
    area?: Area;
    /** A sign-in page: someone already signed in is sent home instead. */
    guest?: boolean;
    /** The lowest tenant role that sees the page; the API enforces it too. */
    minRole?: TenantRole;
  }
}

/** Where each area starts and signs in. */
export const home: Record<Area, string> = { tenant: '/app', ops: '/admin' };
export const loginOf: Record<Area, string> = { tenant: '/login', ops: '/admin/login' };

function authPages(area: Area, prefix: string): RouteRecordRaw[] {
  const meta = { area, guest: true };
  return [
    { path: `${prefix}login`, component: () => import('@/pages/auth/LoginPage.vue'), meta },
    { path: `${prefix}code`, component: () => import('@/pages/auth/CodePage.vue'), meta },
    { path: `${prefix}forgot`, component: () => import('@/pages/auth/ForgotPage.vue'), meta },
    {
      path: `${prefix}reset-password`,
      // The emails link to /ops/reset-password for operators.
      ...(area === 'ops' && { alias: '/ops/reset-password' }),
      component: () => import('@/pages/auth/ResetPage.vue'),
      meta,
    },
  ];
}

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: home.tenant },
  {
    path: '/',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [...authPages('tenant', '/'), ...authPages('ops', '/admin/')],
  },
  {
    path: '/app',
    component: () => import('@/layouts/ShellLayout.vue'),
    meta: { area: 'tenant' },
    children: [
      {
        path: '',
        component: () => import('@/pages/tenant/OverviewPage.vue'),
        meta: { area: 'tenant' },
      },
      {
        path: 'conversations',
        component: () => import('@/pages/tenant/ConversationsPage.vue'),
        meta: { area: 'tenant', minRole: 'agent' },
      },
      {
        path: 'reports',
        component: () => import('@/pages/tenant/ReportsPage.vue'),
        meta: { area: 'tenant', minRole: 'admin' },
      },
      {
        path: 'knowledge',
        component: () => import('@/pages/tenant/KnowledgePage.vue'),
        meta: { area: 'tenant', minRole: 'admin' },
      },
      {
        path: 'credits',
        component: () => import('@/pages/tenant/CreditsPage.vue'),
        meta: { area: 'tenant', minRole: 'admin' },
      },
      {
        path: 'channels',
        component: () => import('@/pages/tenant/ChannelsPage.vue'),
        meta: { area: 'tenant', minRole: 'admin' },
      },
      {
        path: 'mail',
        component: () => import('@/pages/tenant/MailPage.vue'),
        meta: { area: 'tenant', minRole: 'admin' },
      },
      {
        path: 'privacy',
        component: () => import('@/pages/tenant/PrivacyPage.vue'),
        meta: { area: 'tenant', minRole: 'admin' },
      },
      {
        path: 'actions',
        component: () => import('@/pages/tenant/ActionsPage.vue'),
        meta: { area: 'tenant', minRole: 'admin' },
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layouts/ShellLayout.vue'),
    meta: { area: 'ops' },
    children: [
      {
        path: '',
        component: () => import('@/pages/admin/OverviewPage.vue'),
        meta: { area: 'ops' },
      },
      {
        path: 'tenants',
        component: () => import('@/pages/admin/TenantsPage.vue'),
        meta: { area: 'ops' },
      },
      {
        path: 'tenants/:id',
        component: () => import('@/pages/admin/TenantPage.vue'),
        meta: { area: 'ops' },
      },
    ],
  },
  { path: '/:catchAll(.*)*', component: () => import('@/pages/ErrorNotFound.vue') },
];

export default routes;
