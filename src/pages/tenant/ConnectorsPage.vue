<script setup lang="ts">
import { refreshOnFocus } from '@/composables/refreshOnFocus';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Connector } from '@/api/tenant';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { useSessionStore } from '@/stores/session';
import { effectiveRisk, hostOf, toolName } from '@/utils/connectors';

const { t } = useI18n();
const session = useSessionStore();

const items = ref<Connector[]>([]);
const loading = ref(true);
const failed = ref(false);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    items.value = (await session.data.connectors()).items;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
refreshOnFocus(load);

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso));
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.connectors') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.connectors.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.connectors.intro') }}</p>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <q-skeleton v-if="loading && !items.length" height="160px" />
    <div v-else-if="!items.length && !failed" class="ig-card">
      <EmptyState
        icon="hub"
        :title="t('tenant.connectors.empty')"
        :hint="t('tenant.connectors.emptyHint')"
      />
    </div>

    <div class="column q-gutter-y-md">
      <div v-for="c in items" :key="c.name" class="ig-card q-pa-lg">
        <div class="row items-center justify-between q-mb-xs no-wrap">
          <div class="text-h6 ellipsis">{{ c.name }}</div>
          <span class="ig-pill" :class="c.enabled === false ? '' : 'ig-pill--ok'">
            {{ c.enabled === false ? t('tenant.connectors.off') : t('tenant.connectors.on') }}
          </span>
        </div>
        <p v-if="c.description" class="ig-muted q-mt-none q-mb-sm">{{ c.description }}</p>
        <div class="text-caption ig-muted q-mb-md">
          {{ hostOf(c.base_url) }} ·
          {{ c.has_secret ? t('tenant.connectors.secretSet') : t('tenant.connectors.noSecret') }} ·
          {{ t('tenant.connectors.updated', { date: when(c.updated_at) }) }}
        </div>

        <div class="ig-eyebrow q-mb-sm">
          {{ t('tenant.connectors.operations', { n: c.operations.length }) }}
        </div>
        <div v-for="o in c.operations" :key="o.name" class="ig-row" style="cursor: default">
          <div class="col" style="min-width: 0">
            <div class="text-weight-medium ellipsis">{{ toolName(c.name, o.name) }}</div>
            <!-- Text on purpose: it was written by an operator, never rendered as HTML. -->
            <div class="text-caption ig-muted">{{ o.description }}</div>
          </div>
          <span
            class="ig-pill"
            :class="effectiveRisk(o) === 'read' ? 'ig-pill--ok' : 'ig-pill--warn'"
          >
            {{ t(`tenant.connectors.risk.${effectiveRisk(o)}`) }}
          </span>
        </div>
      </div>
    </div>

    <div class="text-caption ig-muted q-mt-lg">{{ t('common.managedByIgnis') }}</div>
  </q-page>
</template>
