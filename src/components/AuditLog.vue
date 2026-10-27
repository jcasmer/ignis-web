<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { AuditClient, AuditEntry } from '@/api/audit';
import type { TenantListItem } from '@/api/ops';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { actionKeys, dayOf, factsOf, OPS_FAMILIES, TENANT_FAMILIES } from '@/utils/audit';

const props = defineProps<{
  client: AuditClient;
  /** The Ignis team reads the whole platform and can narrow it to one client. */
  operator?: boolean;
  tenants?: TenantListItem[];
}>();

const i18n = useI18n();
const { t } = i18n;

const items = ref<AuditEntry[]>([]);
const cursor = ref<string | undefined>();
const loading = ref(true);
const failed = ref(false);

const family = ref('');
const outcome = ref('');
const tenant = ref('');
const from = ref('');
const to = ref('');

const families = computed(() => (props.operator ? OPS_FAMILIES : TENANT_FAMILIES));
const familyOptions = computed(() => [
  { label: t('audit.filters.allActions'), value: '' },
  ...families.value.map((f) => ({ label: t(`audit.families.${f.replace(/\./g, '_')}`), value: f })),
]);
const outcomeOptions = computed(() => [
  { label: t('audit.filters.allOutcomes'), value: '' },
  { label: t('audit.outcome.ok'), value: 'ok' },
  { label: t('audit.outcome.denied'), value: 'denied' },
  { label: t('audit.outcome.failed'), value: 'failed' },
]);
const tenantOptions = computed(() => [
  { label: t('audit.filters.allClients'), value: '' },
  ...(props.tenants ?? []).map((x) => ({ label: x.name, value: x.id })),
]);
const nameOfTenant = (id?: string) => props.tenants?.find((x) => x.id === id)?.name ?? '';

async function load(more = false) {
  loading.value = true;
  failed.value = false;
  try {
    const page = await props.client.list({
      action: family.value,
      outcome: outcome.value,
      from: dayOf(from.value),
      to: dayOf(to.value),
      ...(props.operator && tenant.value && { tenant: tenant.value }),
      ...(more && cursor.value && { cursor: cursor.value }),
      limit: 50,
    });
    items.value = more ? [...items.value, ...page.items] : page.items;
    cursor.value = page.next_cursor;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(() => load());

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

function label(code: string): string {
  for (const key of actionKeys(code)) if (i18n.te(key)) return t(key);
  return t('audit.unknown', { code });
}

function who(e: AuditEntry): string {
  if (e.actor.kind === 'ignis') return t('audit.actor.ignis');
  if (e.actor.name) return e.actor.name;
  return t(`audit.actor.${e.actor.kind}`);
}

const hasFilters = computed(
  () => !!(family.value || outcome.value || tenant.value || from.value || to.value),
);
function clear() {
  family.value = outcome.value = tenant.value = from.value = to.value = '';
  void load();
}
</script>

<template>
  <div>
    <div class="ig-card q-pa-md q-mb-md">
      <div class="row q-col-gutter-sm items-end">
        <div v-if="operator" class="col-12 col-sm-6 col-md-3">
          <q-select
            behavior="menu"
            popup-content-class="ig-menu"
            v-model="tenant"
            outlined
            dense
            emit-value
            map-options
            :options="tenantOptions"
            :label="t('audit.filters.client')"
            @update:model-value="load()"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <q-select
            behavior="menu"
            popup-content-class="ig-menu"
            v-model="family"
            outlined
            dense
            emit-value
            map-options
            :options="familyOptions"
            :label="t('audit.filters.action')"
            @update:model-value="load()"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-2">
          <q-select
            behavior="menu"
            popup-content-class="ig-menu"
            v-model="outcome"
            outlined
            dense
            emit-value
            map-options
            :options="outcomeOptions"
            :label="t('audit.filters.outcome')"
            @update:model-value="load()"
          />
        </div>
        <div class="col-6 col-md-2">
          <q-input
            v-model="from"
            outlined
            dense
            type="date"
            :label="t('audit.filters.from')"
            @update:model-value="load()"
          />
        </div>
        <div class="col-6 col-md-2">
          <q-input
            v-model="to"
            outlined
            dense
            type="date"
            :label="t('audit.filters.to')"
            @update:model-value="load()"
          />
        </div>
      </div>
      <div v-if="hasFilters" class="q-mt-sm">
        <IgButton variant="ghost" size="sm" :label="t('audit.filters.clear')" @click="clear" />
      </div>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load()" />
      </template>
    </IgAlert>

    <div class="ig-card" style="overflow: hidden">
      <q-skeleton v-if="loading && !items.length" height="64px" class="q-ma-md" />
      <EmptyState
        v-else-if="!items.length"
        icon="history"
        :title="t('audit.empty')"
        :hint="hasFilters ? t('audit.emptyFiltered') : t('audit.emptyHint')"
      />
      <div v-for="e in items" :key="e.id" class="ig-row ig-audit__row">
        <div class="ig-audit__when text-caption ig-muted ig-num">{{ when(e.at) }}</div>
        <div class="col" style="min-width: 0">
          <div class="text-weight-medium">{{ label(e.action) }}</div>
          <div class="text-caption ig-muted">
            {{ who(e) }}
            <template v-if="operator && nameOfTenant(e.tenant_id)">
              · {{ nameOfTenant(e.tenant_id) }}
            </template>
            <template v-if="e.actor.role"> · {{ e.actor.role }}</template>
          </div>
          <div v-if="factsOf(e).length" class="text-caption ig-muted ig-code ig-audit__facts">
            {{ factsOf(e).join(' · ') }}
          </div>
        </div>
        <span
          class="ig-pill"
          :class="
            e.outcome === 'ok' ? 'ig-pill--ok' : e.outcome === 'denied' ? 'ig-pill--warn' : ''
          "
        >
          {{ t(`audit.outcome.${e.outcome}`) }}
        </span>
      </div>
      <div v-if="cursor" class="q-pa-sm text-center">
        <IgButton
          variant="ghost"
          size="sm"
          :loading="loading"
          :label="t('audit.more')"
          @click="load(true)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ig-audit__row {
  align-items: flex-start;
  gap: 16px;
}
.ig-audit__when {
  width: 130px;
  flex: none;
  padding-top: 2px;
}
.ig-audit__facts {
  overflow-wrap: anywhere;
}
@media (max-width: 599px) {
  .ig-audit__row {
    flex-wrap: wrap;
    gap: 4px;
  }
  .ig-audit__when {
    width: 100%;
  }
}
</style>
