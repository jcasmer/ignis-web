<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import IgnisMark from '@/components/IgnisMark.vue';
import { toggleTheme } from '@/composables/useTheme';
import { loginOf } from '@/router/routes';
import { useSessionStore } from '@/stores/session';
import { atLeast } from '@/utils/roles';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const area = computed(() => route.meta.area ?? 'tenant');

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

// Grows with each area of the console; every entry here is a real page.
const nav = computed<NavItem[]>(() =>
  area.value === 'ops'
    ? [{ to: '/admin', icon: 'space_dashboard', label: t('admin.nav.overview') }]
    : [
        { to: '/app', icon: 'space_dashboard', label: t('tenant.nav.overview') },
        ...(atLeast(session.tenant?.role, 'agent')
          ? [{ to: '/app/conversations', icon: 'forum', label: t('tenant.nav.conversations') }]
          : []),
        ...(atLeast(session.tenant?.role, 'admin')
          ? [
              { to: '/app/actions', icon: 'task_alt', label: t('tenant.nav.actions') },
              { to: '/app/reports', icon: 'insights', label: t('tenant.nav.reports') },
            ]
          : []),
      ],
);

const who = computed(() =>
  area.value === 'ops' ? (session.operator?.name ?? session.operator?.email) : session.tenant?.role,
);

async function signOut() {
  const target = loginOf[area.value];
  await session.logout();
  await router.replace(target);
}
</script>

<template>
  <q-layout view="hHh LpR lFf">
    <q-header
      class="bg-transparent ig-header"
      style="border-bottom: 1px solid var(--ig-line); backdrop-filter: blur(8px)"
    >
      <q-toolbar>
        <IgnisMark :size="28" />
        <q-badge
          v-if="area === 'ops'"
          color="accent"
          text-color="dark"
          class="q-ml-sm"
          label="admin"
        />
        <q-space />
        <q-btn
          flat
          round
          dense
          icon="contrast"
          :aria-label="t('common.theme')"
          @click="toggleTheme"
        />
        <q-btn
          flat
          no-caps
          icon="logout"
          :label="$q.screen.gt.xs ? t('common.signOut') : undefined"
          :aria-label="t('common.signOut')"
          class="q-ml-sm"
          @click="signOut"
        />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-if="$q.screen.gt.sm"
      :model-value="true"
      persistent
      :width="232"
      bordered
      class="bg-transparent"
    >
      <q-list padding>
        <q-item
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          exact
          clickable
          active-class="text-weight-bold"
          style="border-radius: 10px; margin: 0 8px"
        >
          <q-item-section avatar><q-icon :name="item.icon" /></q-item-section>
          <q-item-section>{{ item.label }}</q-item-section>
        </q-item>
      </q-list>
      <div class="absolute-bottom q-pa-md text-caption ig-muted">{{ who }}</div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- On a phone the menu is at the thumb: a bottom bar instead of a drawer. -->
    <q-footer class="lt-md ig-bottom-nav">
      <q-tabs
        no-caps
        dense
        active-color="accent"
        indicator-color="accent"
        class="text-grey-5"
        :aria-label="t('common.menu')"
      >
        <q-route-tab
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          exact
          :icon="item.icon"
          :label="item.label"
          class="ig-bottom-nav__tab"
        />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>
