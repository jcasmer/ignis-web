<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { HandoffStats, StatsOverview } from '@/api/tenant';
import EChart from '@/components/EChart.vue';
import StatCard from '@/components/StatCard.vue';
import { useSessionStore } from '@/stores/session';
import { chartColors, reasonColors } from '@/utils/palette';
import { atLeast } from '@/utils/roles';
import { change, daysBefore, formatMicroUsd, formatNumber, toChart } from '@/utils/stats';

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
watch(days, load);

const totals = computed(() => stats.value?.totals);
const previous = computed(() => stats.value?.previous);
const messages = (x?: { messages_in: number; messages_out: number }) =>
  x ? x.messages_in + x.messages_out : 0;

const chart = computed(() => (stats.value ? toChart(stats.value) : null));

const axis = {
  axisLine: { lineStyle: { color: '#8884' } },
  splitLine: { lineStyle: { color: '#8882' } },
};

const activityOption = computed(() => ({
  color: [chartColors.amber, chartColors.teal],
  grid: { left: 40, right: 16, top: 36, bottom: 28 },
  legend: { top: 0, textStyle: { color: 'inherit' } },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: chart.value?.labels ?? [], boundaryGap: false, ...axis },
  yAxis: { type: 'value', minInterval: 1, ...axis },
  series: [
    {
      name: t('tenant.overview.charts.received'),
      type: 'line',
      smooth: true,
      symbol: 'none',
      areaStyle: { opacity: 0.15 },
      data: chart.value?.values.messages_in ?? [],
    },
    {
      name: t('tenant.overview.charts.sent'),
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: chart.value?.values.messages_out ?? [],
    },
  ],
}));

const conversationsOption = computed(() => ({
  color: [chartColors.amber],
  grid: { left: 40, right: 16, top: 16, bottom: 28 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: chart.value?.labels ?? [], ...axis },
  yAxis: { type: 'value', minInterval: 1, ...axis },
  series: [
    {
      name: t('tenant.overview.charts.conversations'),
      type: 'bar',
      barMaxWidth: 22,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      data: chart.value?.values.conversations_active ?? [],
    },
  ],
}));

const reasonEntries = computed(() =>
  Object.entries(handoffs.value?.by_reason ?? {}).filter(([, n]) => n > 0),
);

const reasonsOption = computed(() => ({
  tooltip: { trigger: 'item' },
  series: [
    {
      type: 'pie',
      radius: ['55%', '80%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      data: reasonEntries.value.map(([reason, value]) => ({
        name: t(`tenant.overview.reasons.${reason}`),
        value,
        itemStyle: { color: reasonColors[reason] ?? chartColors.sand },
      })),
    },
  ],
}));
</script>

<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-lg q-col-gutter-md">
      <div class="col-12 col-sm">
        <h1 class="text-h4 text-weight-bold q-my-none">{{ t('tenant.overview.title') }}</h1>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.overview.intro') }}</p>
      </div>
      <div v-if="canSeeStats" class="col-12 col-sm-auto">
        <q-btn-toggle
          v-model="days"
          no-caps
          unelevated
          toggle-color="accent"
          toggle-text-color="dark"
          :options="
            ([7, 30, 90] as const).map((d) => ({
              value: d,
              label: t(`tenant.overview.period.${d}`),
            }))
          "
        />
      </div>
    </div>

    <div v-if="!canSeeStats" class="ig-card q-pa-lg ig-muted">
      {{ t('tenant.overview.viewerNote') }}
    </div>

    <template v-else>
      <q-banner v-if="failed" rounded class="ig-card q-mb-md" role="alert">
        {{ t('common.loadError') }}
        <template #action><q-btn flat no-caps :label="t('common.retry')" @click="load" /></template>
      </q-banner>

      <div class="row q-col-gutter-md q-mb-md">
        <div v-for="n in 5" :key="n" class="col-6 col-md-4 col-lg">
          <template v-if="totals && previous">
            <StatCard
              v-if="n === 1"
              icon="chat"
              :label="t('tenant.overview.kpi.messages')"
              :value="formatNumber(messages(totals))"
              :delta="change(messages(totals), messages(previous))"
            />
            <StatCard
              v-else-if="n === 2"
              icon="forum"
              :label="t('tenant.overview.kpi.conversations')"
              :value="formatNumber(totals.conversations_active)"
              :delta="change(totals.conversations_active, previous.conversations_active)"
            />
            <StatCard
              v-else-if="n === 3"
              icon="person_add"
              :label="t('tenant.overview.kpi.contacts')"
              :value="formatNumber(totals.new_contacts)"
              :delta="change(totals.new_contacts, previous.new_contacts)"
            />
            <StatCard
              v-else-if="n === 4"
              icon="support_agent"
              lower-is-better
              :label="t('tenant.overview.kpi.handoffs')"
              :value="formatNumber(totals.handoffs)"
              :delta="change(totals.handoffs, previous.handoffs)"
            />
            <StatCard
              v-else
              icon="bolt"
              lower-is-better
              :label="t('tenant.overview.kpi.cost')"
              :value="formatMicroUsd(totals.charged_micro)"
              :delta="change(totals.charged_micro, previous.charged_micro)"
            />
          </template>
          <q-skeleton v-else height="110px" class="rounded-borders" />
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-12 col-lg-8">
          <div class="ig-card q-pa-md">
            <div class="text-subtitle1 text-weight-medium q-mb-sm">
              {{ t('tenant.overview.charts.activity') }}
            </div>
            <q-skeleton v-if="loading && !stats" height="280px" />
            <EChart v-else :option="activityOption" :label="t('tenant.overview.charts.activity')" />
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="ig-card q-pa-md full-height">
            <div class="text-subtitle1 text-weight-medium q-mb-sm">
              {{ t('tenant.overview.charts.handoffReasons') }}
            </div>
            <template v-if="reasonEntries.length">
              <EChart
                :option="reasonsOption"
                :height="200"
                :label="t('tenant.overview.charts.handoffReasons')"
              />
              <ul class="q-pl-none q-mb-none" style="list-style: none">
                <li
                  v-for="[reason, n] in reasonEntries"
                  :key="reason"
                  class="row items-center no-wrap q-mt-xs"
                >
                  <span
                    class="q-mr-sm"
                    :style="{
                      background: reasonColors[reason] ?? chartColors.sand,
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                    }"
                  />
                  <span class="col text-body2">{{ t(`tenant.overview.reasons.${reason}`) }}</span>
                  <span class="text-weight-medium">{{ n }}</span>
                </li>
              </ul>
              <div v-if="handoffs && handoffs.expired > 0" class="text-caption ig-muted q-mt-sm">
                {{ t('tenant.overview.charts.selfResolved') }}: {{ handoffs.expired }}
              </div>
            </template>
            <div v-else class="ig-muted q-pa-md text-center">
              {{ t('tenant.overview.charts.noHandoffs') }}
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="ig-card q-pa-md">
            <div class="text-subtitle1 text-weight-medium q-mb-sm">
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
