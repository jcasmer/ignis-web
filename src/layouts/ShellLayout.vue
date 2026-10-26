<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import IgButton from '@/components/IgButton.vue';
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
              { to: '/app/reports', icon: 'insights', label: t('tenant.nav.reports') },
              { to: '/app/actions', icon: 'task_alt', label: t('tenant.nav.actions') },
            ]
          : []),
      ],
);

const who = computed(() => {
  if (area.value === 'ops') {
    const o = session.operator;
    return { name: o?.name ?? o?.email ?? '', detail: o ? t(`admin.roles.${o.role}`) : '' };
  }
  const role = session.tenant?.role;
  return { name: role ? t(`tenant.roles.${role}`) : '', detail: t('app.name') };
});
const initial = computed(() => (who.value.name || 'I').charAt(0).toUpperCase());

async function signOut() {
  const target = loginOf[area.value];
  await session.logout();
  await router.replace(target);
}
</script>

<template>
  <q-layout view="hHh LpR lFf">
    <q-header class="ig-header">
      <q-toolbar style="min-height: 56px">
        <!-- The brand lives in the sidebar on a desktop; on a phone it is here. -->
        <div class="lt-md row items-center no-wrap">
          <IgnisMark :size="28" />
          <span v-if="area === 'ops'" class="ig-pill ig-pill--amber q-ml-sm">admin</span>
        </div>
        <q-space />
        <IgButton
          variant="ghost"
          icon-only
          icon="contrast"
          :label="t('common.theme')"
          @click="toggleTheme"
        />
        <IgButton variant="ghost" icon-only :label="who.name" class="q-ml-xs">
          <span class="ig-avatar">{{ initial }}</span>
          <q-menu anchor="bottom right" self="top right" :offset="[0, 8]" class="ig-menu">
            <div class="row items-center no-wrap q-pa-md q-gutter-x-md">
              <span class="ig-avatar ig-avatar--lg">{{ initial }}</span>
              <div class="col" style="min-width: 0">
                <div class="text-weight-bold ellipsis">{{ who.name }}</div>
                <div class="text-caption ig-muted ellipsis">{{ who.detail }}</div>
              </div>
            </div>
            <q-separator />
            <q-list padding>
              <q-item
                v-close-popup
                clickable
                class="q-mx-sm"
                style="border-radius: 10px"
                @click="signOut"
              >
                <q-item-section avatar style="min-width: 36px">
                  <q-icon name="logout" />
                </q-item-section>
                <q-item-section>{{ t('common.signOut') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </IgButton>
      </q-toolbar>
    </q-header>

    <q-drawer v-if="$q.screen.gt.sm" :model-value="true" persistent :width="248" class="ig-sidebar">
      <div class="ig-sidebar__brand">
        <IgnisMark :size="30" />
        <span v-if="area === 'ops'" class="ig-pill ig-pill--amber q-ml-sm">admin</span>
      </div>
      <nav class="ig-nav" :aria-label="t('common.menu')">
        <router-link v-for="item in nav" :key="item.to" :to="item.to" class="ig-nav__item">
          <q-icon :name="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
    </q-drawer>

    <q-page-container>
      <router-view #default="{ Component, route: current }">
        <transition name="ig-page" appear>
          <component :is="Component" :key="current.path" />
        </transition>
      </router-view>
    </q-page-container>

    <!-- On a phone the menu is at the thumb: a bottom bar instead of a drawer. -->
    <q-footer class="lt-md ig-bottom-nav">
      <nav class="ig-bottom-nav__list" :aria-label="t('common.menu')">
        <router-link v-for="item in nav" :key="item.to" :to="item.to" class="ig-bottom-nav__item">
          <q-icon :name="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
    </q-footer>
  </q-layout>
</template>
