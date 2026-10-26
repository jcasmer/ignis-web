<script setup lang="ts">
import { refreshOnFocus } from '@/composables/refreshOnFocus';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { HandoffStats, StatsOverview } from '@/api/tenant';
import EChart from '@/components/EChart.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import StatCard from '@/components/StatCard.vue';
import { useSessionStore } from '@/stores/session';
import { axisStyle, barSeries, legendStyle, lineSeries } from '@/utils/chartTheme';
import { chartColors, metricColors, reasonColors } from '@/utils/palette';
import { atLeast } from '@/utils/roles';
import { change, daysBefore, formatNumber, toChart } from '@/utils/stats';

const { t } = useI18n();
const session = useSessionStore();

const canSeeStats = computed(() => atLeast(session.tenant?.role, 'admin'));

const days = ref<7 | 30 | 90>(30);
const stats = ref<StatsOverview | null>(null);
const handoffs = ref<HandoffStats | null>(null);
const loading = ref(false);
const failed = ref(false);

async function load() {
  if (!canSeeStats.value) return;
  loading.value = true;
  failed.value = false;
  try {
    const to = new Date();
    const [s, h] = await Promise.all([
      session.data.stats({
        from: daysBefore(to, days.value - 1),
        to: daysBefore(to, 0),
        granularity: days.value === 90 ? 'week' : 'day',
      }),
      session.data.handoffStats(days.value),
    ]);
    stats.value = s;
    handoffs.value = h;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
refreshOnFocus(load);
watch(days, load);

const totals = computed(() => stats.value?.totals);
const previous = computed(() => stats.value?.previous);
const chart = computed(() => (stats.value ? toChart(stats.value) : null));
const messages = (x?: { messages_in: number; messages_out: number }) =>
  x ? x.messages_in + x.messages_out : 0;
const sum = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] ?? 0));

interface Kpi {
  key: string;
  color: string;
  icon: string;
  label: string;
  value: number;
  delta: number | null;
  spark: number[];
  format?: 'usd';
  lowerIsBetter?: boolean;
}

const kpis = computed<Kpi[]>(() => {
  const c = totals.value;
  const p = previous.value;
  const v = chart.value?.values;
  if (!c || !p || !v) return [];
  return [
    {
      key: 'messages',
      color: chartColors.brand,
      icon: 'chat_bubble',
      label: t('tenant.overview.kpi.messages'),
      value: messages(c),
      delta: change(messages(c), messages(p)),
      spark: sum(v.messages_in, v.messages_out),
    },
    {
      key: 'conversations',
      color: metricColors.conversations_active,
      icon: 'forum',
      label: t('tenant.overview.kpi.conversations'),
      value: c.conversations_active,
      delta: change(c.conversations_active, p.conversations_active),
      spark: v.conversations_active,
    },
    {
      key: 'contacts',
      color: metricColors.new_contacts,
      icon: 'person_add',
      label: t('tenant.overview.kpi.contacts'),
      value: c.new_contacts,
      delta: change(c.new_contacts, p.new_contacts),
      spark: v.new_contacts,
    },
    {
      key: 'handoffs',
      color: metricColors.handoffs,
      icon: 'support_agent',
      label: t('tenant.overview.kpi.handoffs'),
      value: c.handoffs,
      delta: change(c.handoffs, p.handoffs),
      spark: v.handoffs,
      lowerIsBetter: true,
    },
    {
      key: 'cost',
      color: metricColors.charged_micro,
      icon: 'bolt',
      label: t('tenant.overview.kpi.cost'),
      value: c.charged_micro,
      delta: change(c.charged_micro, p.charged_micro),
      spark: v.charged_micro,
      format: 'usd',
      lowerIsBetter: true,
    },
  ];
});

const css = (name: string, fallback: string) =>
  getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;

const activityOption = computed(() => ({
  grid: { left: 8, right: 8, top: 40, bottom: 8, containLabel: true },
  legend: legendStyle,
  tooltip: { trigger: 'axis' },
  xAxis: { ...axisStyle.xAxis, boundaryGap: false, data: chart.value?.labels ?? [] },
  yAxis: { ...axisStyle.yAxis, minInterval: 1 },
  series: [
    lineSeries(
      t('tenant.overview.charts.received'),
      chart.value?.values.messages_in ?? [],
      metricColors.messages_in,
      { area: true },
    ),
    lineSeries(
      t('tenant.overview.charts.sent'),
      chart.value?.values.messages_out ?? [],
      metricColors.messages_out,
    ),
  ],
}));

const conversationsOption = computed(() => ({
  grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis' },
  xAxis: { ...axisStyle.xAxis, data: chart.value?.labels ?? [] },
  yAxis: { ...axisStyle.yAxis, minInterval: 1 },
  series: [
    barSeries(
      t('tenant.overview.charts.conversations'),
      chart.value?.values.conversations_active ?? [],
      metricColors.conversations_active,
    ),
  ],
}));

const reasonEntries = computed(() =>
  Object.entries(handoffs.value?.by_reason ?? {}).filter(([, n]) => n > 0),
);
const reasonTotal = computed(() => reasonEntries.value.reduce((n, [, v]) => n + v, 0));

const reasonsOption = computed(() => ({
  tooltip: { trigger: 'item' },
  graphic: [
    {
      type: 'text',
      left: 'center',
      top: '38%',
      style: {
        text: formatNumber(reasonTotal.value),
        fontSize: 30,
        fontWeight: 750,
        fill: css('--ig-text', '#1b1a17'),
      },
    },
    {
      type: 'text',
      left: 'center',
      top: '56%',
      style: {
        text: t('tenant.overview.charts.handoffUnit'),
        fontSize: 12,
        fill: css('--ig-muted', '#6b6558'),
      },
    },
  ],
  series: [
    {
      type: 'pie',
      radius: ['64%', '86%'],
      padAngle: 3,
      itemStyle: { borderRadius: 8 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data: reasonEntries.value.map(([reason, value]) => ({
        name: t(`tenant.overview.reasons.${reason}`),
        value,
        itemStyle: { color: reasonColors[reason] ?? chartColors.stone },
      })),
    },
  ],
}));
</script>

<template>
  <q-page padding>
    <div class="row items-end justify-between q-mb-lg q-col-gutter-md">
      <div class="col-12 col-sm">
        <div class="ig-eyebrow q-mb-xs">{{ t('app.name') }}</div>
        <h1 class="text-h4 q-my-none">{{ t('tenant.overview.title') }}</h1>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.overview.intro') }}</p>
      </div>
      <div v-if="canSeeStats" class="col-12 col-sm-auto ig-scroll-x">
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

    <IgAlert v-if="!canSeeStats" tone="info">{{ t('tenant.overview.viewerNote') }}</IgAlert>

    <template v-else>
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
              :color="k.color"
              :label="k.label"
              :value="k.value"
              :format="k.format"
              :delta="k.delta"
              :lower-is-better="k.lowerIsBetter"
              :spark="k.spark"
              :compare-label="t('common.vsPrevious')"
              :no-compare-label="t('common.noComparison')"
            />
          </div>
        </template>
        <template v-else>
          <div v-for="n in 5" :key="n" class="col-6 col-md-4 col-lg">
            <q-skeleton height="150px" />
          </div>
        </template>
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-12 col-lg-8">
          <div class="ig-card q-pa-md full-height">
            <div class="ig-section-title q-mb-sm">{{ t('tenant.overview.charts.activity') }}</div>
            <q-skeleton v-if="loading && !stats" height="300px" />
            <EChart
              v-else
              :option="activityOption"
              :height="300"
              :label="t('tenant.overview.charts.activity')"
            />
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="ig-card q-pa-md full-height">
            <div class="ig-section-title q-mb-sm">
              {{ t('tenant.overview.charts.handoffReasons') }}
            </div>
            <template v-if="reasonEntries.length">
              <EChart
                :option="reasonsOption"
                :height="210"
                :label="t('tenant.overview.charts.handoffReasons')"
              />
              <ul class="ig-legend">
                <li v-for="[reason, n] in reasonEntries" :key="reason" class="ig-legend__row">
                  <span
                    class="ig-legend__dot"
                    :style="{ background: reasonColors[reason] ?? chartColors.stone }"
                  />
                  <span>{{ t(`tenant.overview.reasons.${reason}`) }}</span>
                  <span class="ig-legend__value">{{ n }}</span>
                </li>
              </ul>
              <div v-if="handoffs && handoffs.expired > 0" class="ig-pill ig-pill--ok q-mt-sm">
                <q-icon name="auto_awesome" size="14px" />
                {{ t('tenant.overview.charts.selfResolved') }}: {{ handoffs.expired }}
              </div>
            </template>
            <div v-else class="ig-empty">
              <div class="ig-empty__icon"><q-icon name="check_circle" size="26px" /></div>
              <div>{{ t('tenant.overview.charts.noHandoffs') }}</div>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="ig-card q-pa-md">
            <div class="ig-section-title q-mb-sm">
              {{ t('tenant.overview.charts.conversations') }}
            </div>
            <q-skeleton v-if="loading && !stats" height="220px" />
            <EChart
              v-else
              :option="conversationsOption"
              :height="220"
              :label="t('tenant.overview.charts.conversations')"
            />
          </div>
        </div>
      </div>
    </template>
  </q-page>
</template>
