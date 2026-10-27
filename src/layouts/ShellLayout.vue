<script setup lang="ts">
import { computed, ref } from 'vue';
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
  /** A heading shown in the sidebar before this entry. */
  section?: string;
}

// Grows with each area of the console; every entry here is a real page.
const nav = computed<NavItem[]>(() =>
  area.value === 'ops'
    ? [
        { to: '/admin', icon: 'space_dashboard', label: t('admin.nav.overview') },
        { to: '/admin/tenants', icon: 'domain', label: t('admin.nav.tenants') },
        { to: '/admin/queue', icon: 'low_priority', label: t('admin.nav.queue') },
        { to: '/admin/demo', icon: 'play_circle', label: t('admin.nav.demo') },
        { to: '/admin/plans', icon: 'workspace_premium', label: t('admin.nav.plans') },
        { to: '/admin/packages', icon: 'inventory_2', label: t('admin.nav.packages') },
        { to: '/admin/prices', icon: 'sell', label: t('admin.nav.prices') },
        { to: '/admin/audit', icon: 'history', label: t('admin.nav.audit') },
        ...(session.operator?.role === 'super'
          ? [{ to: '/admin/operators', icon: 'groups', label: t('admin.nav.operators') }]
          : []),
        { to: '/admin/help', icon: 'help_outline', label: t('admin.nav.help') },
      ]
    : [
        { to: '/app', icon: 'space_dashboard', label: t('tenant.nav.overview') },
        ...(atLeast(session.tenant?.role, 'agent')
          ? [{ to: '/app/conversations', icon: 'forum', label: t('tenant.nav.conversations') }]
          : []),
        ...(atLeast(session.tenant?.role, 'admin')
          ? [
              { to: '/app/reports', icon: 'insights', label: t('tenant.nav.reports') },
              { to: '/app/actions', icon: 'task_alt', label: t('tenant.nav.actions') },
              { to: '/app/automations', icon: 'bolt', label: t('tenant.nav.automations') },
              {
                to: '/app/assistant',
                icon: 'smart_toy',
                label: t('tenant.nav.assistant'),
                section: t('tenant.nav.manage'),
              },
              { to: '/app/knowledge', icon: 'menu_book', label: t('tenant.nav.knowledge') },
              { to: '/app/credits', icon: 'toll', label: t('tenant.nav.credits') },
              { to: '/app/channels', icon: 'cell_tower', label: t('tenant.nav.channels') },
              { to: '/app/whatsapp', icon: 'forum', label: t('tenant.nav.whatsapp') },
              { to: '/app/connectors', icon: 'hub', label: t('tenant.nav.connectors') },
              { to: '/app/mail', icon: 'mail_outline', label: t('tenant.nav.mail') },
              { to: '/app/privacy', icon: 'shield', label: t('tenant.nav.privacy') },
              { to: '/app/audit', icon: 'history', label: t('tenant.nav.audit') },
            ]
          : []),
        { to: '/app/help', icon: 'help_outline', label: t('tenant.nav.help') },
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
// A phone's bottom bar fits four destinations and a "More" sheet for the rest.
const MOBILE_SLOTS = 4;
const mobileMain = computed(() =>
  nav.value.length > 5 ? nav.value.slice(0, MOBILE_SLOTS) : nav.value,
);
const mobileMore = computed(() => (nav.value.length > 5 ? nav.value.slice(MOBILE_SLOTS) : []));
const moreOpen = ref(false);
const moreActive = computed(() => mobileMore.value.some((i) => i.to === route.path));

const initial = computed(() => (who.value.name || 'I').charAt(0).toUpperCase());

// A section stays marked while one of its pages is open (a tenant's detail is part of Clientes).
const isActive = (to: string) =>
  to === '/app' || to === '/admin'
    ? route.path === to
    : route.path === to || route.path.startsWith(`${to}/`);

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
          <span v-if="area === 'ops'" class="ig-pill ig-pill--brand q-ml-sm">admin</span>
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
        <span v-if="area === 'ops'" class="ig-pill ig-pill--brand q-ml-sm">admin</span>
      </div>
      <nav class="ig-nav" :aria-label="t('common.menu')">
        <template v-for="item in nav" :key="item.to">
          <div v-if="item.section" class="ig-nav__label ig-eyebrow">{{ item.section }}</div>
          <router-link
            :to="item.to"
            class="ig-nav__item"
            :class="{ 'router-link-exact-active': isActive(item.to) }"
          >
            <q-icon :name="item.icon" />
            <span>{{ item.label }}</span>
          </router-link>
        </template>
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
        <router-link
          v-for="item in mobileMain"
          :key="item.to"
          :to="item.to"
          class="ig-bottom-nav__item"
          :class="{ 'router-link-exact-active': isActive(item.to) }"
        >
          <q-icon :name="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>
        <button
          v-if="mobileMore.length"
          type="button"
          class="ig-bottom-nav__item ig-bottom-nav__more"
          :class="{ 'router-link-exact-active': moreActive }"
          @click="moreOpen = true"
        >
          <q-icon name="grid_view" />
          <span>{{ t('common.more') }}</span>
        </button>
      </nav>
    </q-footer>

    <q-dialog v-model="moreOpen" position="bottom">
      <div class="ig-sheet">
        <div class="ig-sheet__grip" />
        <router-link
          v-for="item in mobileMore"
          :key="item.to"
          :to="item.to"
          class="ig-sheet__item"
          @click="moreOpen = false"
        >
          <q-icon :name="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>
    </q-dialog>
  </q-layout>
</template>
