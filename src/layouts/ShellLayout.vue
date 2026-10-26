<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import IgnisMark from '@/components/IgnisMark.vue';
import { toggleTheme } from '@/composables/useTheme';
import { loginOf } from '@/router/routes';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const area = computed(() => route.meta.area ?? 'tenant');
const drawer = ref(false);

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

// Grows with each area of the console; every entry here is a real page.
const nav = computed<NavItem[]>(() =>
  area.value === 'ops'
    ? [{ to: '/admin', icon: 'space_dashboard', label: t('admin.nav.overview') }]
    : [{ to: '/app', icon: 'space_dashboard', label: t('tenant.nav.overview') }],
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
      class="bg-transparent text-inherit"
      style="border-bottom: 1px solid var(--ig-line); backdrop-filter: blur(8px)"
    >
      <q-toolbar>
        <q-btn
          flat
          round
          dense
          icon="menu"
          aria-label="Menu"
          class="lt-md"
          @click="drawer = !drawer"
        />
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
          :label="t('common.signOut')"
          class="q-ml-sm"
          @click="signOut"
        />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawer" show-if-above :width="232" bordered class="bg-transparent">
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
  </q-layout>
</template>
