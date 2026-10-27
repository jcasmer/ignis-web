<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { BillingSummary, QueueStats } from '@/api/ops';
import EChart from '@/components/EChart.vue';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import StatCard from '@/components/StatCard.vue';
import { useSessionStore } from '@/stores/session';
import { axisStyle, barSeries } from '@/utils/chartTheme';
import { chartColors, metricColors } from '@/utils/palette';
import { daysBefore, formatMicroUsd } from '@/utils/stats';

const { t } = useI18n();
const session = useSessionStore();

const days = ref<7 | 30 | 90>(30);
const billing = ref<BillingSummary | null>(null);
const queue = ref<QueueStats | null>(null);
const tenantCount = ref<number | null>(null);
const loading = ref(true);
const failed = ref(false);

async function load() {
  loading.value = true;
  failed.value = false;
  const to = new Date();
  try {
    const [b, q, tn] = await Promise.all([
      session.ops.billing({ from: daysBefore(to, days.value - 1), to: daysBefore(to, 0) }),
      session.ops.queue(),
      session.ops.tenants({ limit: 200 }),
    ]);
    billing.value = b;
    queue.value = q;
    tenantCount.value = tn.items.length;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(days, load);

const totals = computed(() => billing.value?.totals);
const top = computed(() =>
  [...(billing.value?.items ?? [])]
    .filter((r) => r.charged_micro > 0)
    .sort((a, b) => b.charged_micro - a.charged_micro)
    .slice(0, 8),
);

const kpis = computed(() => {
  const c = totals.value;
  if (!c) return [];
  return [
    {
      key: 'clients',
      icon: 'domain',
      label: t('admin.overview.clients'),
      value: tenantCount.value ?? 0,
      color: chartColors.brand,
      money: false,
    },
    {
      key: 'charged',
      icon: 'bolt',
      label: t('admin.overview.charged'),
      value: c.charged_micro,
      color: metricColors.charged_micro,
      money: true,
    },
    {
      key: 'cost',
      icon: 'receipt_long',
      label: t('admin.overview.cost'),
      value: c.cost_micro,
      color: chartColors.slate,
      money: true,
    },
    {
      key: 'margin',
      icon: 'trending_up',
      label: t('admin.overview.margin'),
      value: c.margin_micro,
      color: chartColors.green,
      money: true,
    },
    {
      key: 'owed',
      icon: 'account_balance_wallet',
      label: t('admin.overview.owed'),
      value: c.held_purchased_micro,
      color: chartColors.violet,
      money: true,
    },
  ];
});

const barOption = computed(() => ({
  grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatMicroUsd(v * 1_000_000) },
  xAxis: { ...axisStyle.xAxis, data: top.value.map((r) => r.name) },
  yAxis: { ...axisStyle.yAxis, axisLabel: { fontSize: 11, formatter: (v: number) => `$${v}` } },
  series: [
    barSeries(
      t('admin.overview.charged'),
      top.value.map((r) => r.charged_micro / 1_000_000),
      metricColors.charged_micro,
    ),
  ],
}));

const queueBad = computed(
  () => (queue.value?.counts.dead ?? 0) > 0 || (queue.value?.stuck.length ?? 0) > 0,
);
const QUEUE_KEYS = ['ready', 'running', 'done', 'dead'] as const;
</script>

<template>
  <q-page padding>
    <div class="row items-end justify-between q-mb-lg q-col-gutter-md">
      <div class="col-12 col-sm">
        <div class="ig-eyebrow q-mb-xs">{{ t('app.name') }}</div>
        <h1 class="text-h4 q-my-none">{{ t('admin.overview.title') }}</h1>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('admin.overview.intro') }}</p>
      </div>
      <div class="col-12 col-sm-auto ig-scroll-x">
        <IgSegmented
          v-model="days"
          :label="t('tenant.reports.range')"
          :options="
            ([7, 30, 90] as const).map((d) => ({
              value: d,
              label: t(`tenant.overview.period.${d}`),
            }))
          "
        />
      </div>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <div class="row q-col-gutter-md q-mb-md">
      <template v-if="kpis.length">
        <div
          v-for="(k, i) in kpis"
          :key="k.key"
          :class="i === 4 ? 'col-12 col-sm-6 col-md-4 col-lg' : 'col-6 col-md-4 col-lg'"
        >
          <StatCard
            :icon="k.icon"
            :label="k.label"
            :value="k.value"
            :format="k.money ? 'usd' : undefined"
            :color="k.color"
            :compare-label="''"
            :no-compare-label="''"
          />
        </div>
      </template>
      <template v-else>
        <div v-for="n in 5" :key="n" class="col-6 col-md-4 col-lg">
          <q-skeleton height="120px" />
        </div>
      </template>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-lg-8">
        <div class="ig-card q-pa-md full-height">
          <div class="ig-section-title q-mb-sm">{{ t('admin.overview.byTenant') }}</div>
          <q-skeleton v-if="loading && !billing" height="280px" />
          <EChart
            v-else-if="top.length"
            :option="barOption"
            :height="280"
            :label="t('admin.overview.byTenant')"
          />
          <EmptyState v-else icon="insights" :title="t('admin.overview.noBilling')" />
        </div>
      </div>
      <div class="col-12 col-lg-4">
        <div class="ig-card q-pa-md full-height">
          <div class="ig-section-title q-mb-sm">{{ t('admin.overview.queue') }}</div>
          <q-skeleton v-if="!queue" height="180px" />
          <template v-else>
            <IgAlert :tone="queueBad ? 'warn' : 'success'" class="q-mb-md">
              {{ queueBad ? t('admin.overview.queueBad') : t('admin.overview.queueOk') }}
            </IgAlert>
            <div class="row q-col-gutter-sm">
              <div v-for="k in QUEUE_KEYS" :key="k" class="col-6">
                <div class="ig-card q-pa-sm text-center" style="box-shadow: none">
                  <div class="text-h6 text-weight-bold ig-num">{{ queue.counts[k] ?? 0 }}</div>
                  <div class="text-caption ig-muted">
                    {{ t(`admin.overview.queueStates.${k}`) }}
                  </div>
                </div>
              </div>
            </div>
            <div class="text-caption ig-muted q-mt-md">
              {{ t('admin.overview.oldest') }}:
              {{ t('admin.overview.seconds', { n: queue.oldest_ready_age_seconds }) }}
            </div>
            <div
              v-if="queue.stuck.length"
              class="text-caption q-mt-xs"
              style="color: var(--ig-warn)"
            >
              {{ t('admin.overview.stuck') }}: {{ queue.stuck.length }}
            </div>
            <div class="q-mt-md">
              <IgButton
                :variant="queueBad ? 'primary' : 'secondary'"
                block
                icon="low_priority"
                :to="queueBad ? '/admin/queue?state=dead' : '/admin/queue'"
                :label="queueBad ? t('admin.overview.reviewJobs') : t('admin.overview.openQueue')"
              />
            </div>
          </template>
        </div>
      </div>
    </div>
    <div v-if="totals" class="text-caption ig-muted q-mt-md">
      {{ t('admin.overview.owedHint') }}
    </div>
  </q-page>
</template>
