<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Catalog, Plan } from '@/api/ops';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import PlanDialog from '@/components/PlanDialog.vue';
import { useCatalogName } from '@/composables/catalogName';
import { useSessionStore } from '@/stores/session';
import { formatMinor } from '@/utils/format';
import { aiOf, creditOf, formOf, inputOf } from '@/utils/plans';
import { formatMicroUsd } from '@/utils/stats';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();
const nameOf = useCatalogName();

const plans = ref<Plan[]>([]);
const catalog = ref<Catalog | null>(null);
const loading = ref(true);
const failed = ref(false);
const busy = ref<string | null>(null);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    const [p, c] = await Promise.all([session.ops.plans(), session.ops.catalog()]);
    plans.value = p.items;
    catalog.value = c;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const editing = ref<Plan | undefined>();
const dialog = ref(false);

function start(p?: Plan) {
  editing.value = p;
  dialog.value = true;
}

// A plan taken off sale cannot be given to a new client; its clients keep it.
async function toggle(p: Plan) {
  const body = inputOf({ ...formOf(p), active: !p.active }, false);
  if (!body) return;
  busy.value = p.id;
  try {
    await session.ops.replacePlan(p.id, body);
    $q.notify({ type: 'positive', message: t('admin.plans.saved') });
    await load();
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    busy.value = null;
  }
}

const shown = computed(() => plans.value);
const modulesText = (p: Plan) => p.modules.map((m) => nameOf('modules', m));
</script>

<template>
  <q-page padding>
    <div class="row items-end justify-between q-mb-lg q-col-gutter-md">
      <div class="col-12 col-sm">
        <div class="ig-eyebrow q-mb-xs">{{ t('admin.nav.plans') }}</div>
        <h1 class="text-h4 q-my-none">{{ t('admin.plans.title') }}</h1>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('admin.plans.intro') }}</p>
      </div>
      <div class="col-12 col-sm-auto">
        <IgButton
          variant="primary"
          icon="add"
          :disable="!catalog"
          :label="t('admin.plans.new')"
          @click="start()"
        />
      </div>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <q-skeleton v-if="loading && !plans.length" height="180px" />
    <div v-else-if="!plans.length && !failed" class="ig-card">
      <EmptyState
        icon="workspace_premium"
        :title="t('admin.plans.empty')"
        :hint="t('admin.plans.emptyHint')"
      />
    </div>

    <div class="row q-col-gutter-md">
      <div v-for="p in shown" :key="p.id" class="col-12 col-md-6 col-lg-4">
        <div
          class="ig-card q-pa-lg full-height column no-wrap"
          :style="p.active ? '' : 'opacity: 0.72'"
        >
          <div class="row items-center justify-between q-mb-xs no-wrap">
            <div class="text-subtitle1 text-weight-bold ellipsis">{{ p.name }}</div>
            <div class="row q-gutter-x-xs no-wrap">
              <span v-if="p.kind === 'custom'" class="ig-pill ig-pill--brand">
                {{ t('admin.plans.kind.custom') }}
              </span>
              <span class="ig-pill" :class="p.active ? 'ig-pill--ok' : ''">
                {{ p.active ? t('admin.plans.onSale') : t('admin.plans.withdrawn') }}
              </span>
            </div>
          </div>
          <div class="text-caption ig-muted ig-code q-mb-sm">{{ p.id }}</div>

          <div class="text-h5 ig-num">
            {{ formatMinor(p.price_minor, p.currency) }}
            <span class="text-caption ig-muted">{{ t('admin.plans.perMonth') }}</span>
          </div>
          <p class="ig-muted q-mt-sm q-mb-md">{{ p.description || '—' }}</p>

          <div class="q-mb-md">
            <span class="ig-pill" :class="aiOf(p) === 'none' ? '' : 'ig-pill--brand'">
              {{ t(`admin.plans.ai.${aiOf(p)}`) }}
            </span>
            <div class="text-body2 q-mt-sm">
              <template v-if="creditOf(p) > 0">
                {{ t('admin.plans.includesCredit', { amount: formatMicroUsd(creditOf(p)) }) }}
              </template>
              <template v-else>{{ t('admin.plans.noCredit') }}</template>
            </div>
          </div>

          <div class="ig-eyebrow q-mb-xs">{{ t('admin.plans.modules') }}</div>
          <div class="row q-gutter-xs q-mb-md">
            <span v-for="m in modulesText(p)" :key="m" class="ig-pill">{{ m }}</span>
            <span v-if="!p.modules.length" class="text-caption ig-muted">—</span>
          </div>

          <div class="text-caption ig-muted q-mb-md">
            {{ t('admin.plans.clients', { n: p.tenants }, p.tenants) }}
          </div>

          <div class="row q-gutter-sm q-mt-auto">
            <IgButton variant="primary" :label="t('admin.plans.editButton')" @click="start(p)" />
            <IgButton
              variant="secondary"
              :loading="busy === p.id"
              :label="p.active ? t('admin.plans.withdraw') : t('admin.plans.putOnSale')"
              @click="toggle(p)"
            />
          </div>
        </div>
      </div>
    </div>

    <PlanDialog v-if="catalog" v-model="dialog" :plan="editing" :catalog="catalog" @saved="load" />
  </q-page>
</template>
