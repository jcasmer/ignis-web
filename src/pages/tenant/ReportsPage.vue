<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { StatsOverview } from '@/api/tenant';
import EChart from '@/components/EChart.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import { useSessionStore } from '@/stores/session';
import { axisStyle, legendStyle, lineSeries } from '@/utils/chartTheme';
import { chartColors } from '@/utils/palette';
import {
  change,
  daysBefore,
  formatChange,
  formatMicroUsd,
  formatNumber,
  periodLabel,
  previousWindow,
  rangeDays,
  seriesValues,
  toCsv,
  type Metric,
} from '@/utils/stats';

const { t } = useI18n();
const session = useSessionStore();

const MAX_DAYS = 366;
const metrics: Metric[] = [
  'messages_in',
  'messages_out',
  'conversations_active',
  'new_contacts',
  'handoffs',
  'llm_calls',
  'charged_micro',
];

const preset = ref<7 | 30 | 90 | 'custom'>(30);
const today = () => daysBefore(new Date(), 0);
const range = ref({ from: daysBefore(new Date(), 29), to: today() });
const metric = ref<Metric>('messages_in');
const granularity = ref<'day' | 'week'>('day');

const current = ref<StatsOverview | null>(null);
const previous = ref<StatsOverview | null>(null);
const loading = ref(false);
const failed = ref(false);
const rangeError = ref('');

const days = computed(() => rangeDays(range.value.from, range.value.to));
const prevRange = computed(() => previousWindow(range.value.from, range.value.to));

watch(preset, (p) => {
  if (p === 'custom') return;
  range.value = { from: daysBefore(new Date(), p - 1), to: today() };
});

// The date picker hands back a string for one day or { from, to } for a range.
function pick(v: string | { from: string; to: string } | null) {
  if (!v) return;
  const next = typeof v === 'string' ? { from: v, to: v } : v;
  range.value = { from: next.from.replaceAll('/', '-'), to: next.to.replaceAll('/', '-') };
  preset.value = 'custom';
}

async function load() {
  rangeError.value = '';
  if (days.value < 1 || range.value.from > range.value.to) {
    rangeError.value = t('tenant.reports.rangeInvalid');
    return;
  }
  if (days.value > MAX_DAYS) {
    rangeError.value = t('tenant.reports.rangeTooLong');
    return;
  }
  loading.value = true;
  failed.value = false;
  try {
    const [c, p] = await Promise.all([
      session.data.stats({ ...range.value, granularity: granularity.value }),
      session.data.stats({ ...prevRange.value, granularity: granularity.value }),
    ]);
    current.value = c;
    previous.value = p;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([range, granularity], load);

const fmt = (m: Metric, v: number) => (m === 'charged_micro' ? formatMicroUsd(v) : formatNumber(v));
const labelOf = (m: Metric) => t(`tenant.reports.metrics.${m}`);
const longDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

const rows = computed(() =>
  metrics.map((m) => {
    const now = current.value?.totals[m] ?? 0;
    const before = current.value?.previous[m] ?? 0;
    return { metric: m, now, before, delta: change(now, before) };
  }),
);

const chartOption = computed(() => {
  const cur = current.value;
  const prev = previous.value;
  const labels = cur ? cur.series.map((p) => periodLabel(p.period, cur.granularity)) : [];
  const now = cur ? seriesValues(cur.series, metric.value) : [];
  const before = prev ? seriesValues(prev.series, metric.value) : [];
  const money = metric.value === 'charged_micro';
  const show = (v: number) => (money ? v / 1_000_000 : v);
  return {
    grid: { left: 8, right: 8, top: 40, bottom: 8, containLabel: true },
    legend: legendStyle,
    tooltip: {
      trigger: 'axis',
      formatter: (items: { dataIndex: number }[]) => {
        const i = items[0]?.dataIndex ?? 0;
        const lines = [
          `<b>${labels[i] ?? ''}</b>`,
          `<span style="color:${chartColors.brand}">●</span> ${t('tenant.reports.current')}: <b>${fmt(metric.value, now[i] ?? 0)}</b>`,
        ];
        const pp = prev?.series[i];
        if (pp) {
          lines.push(
            `<span style="color:${chartColors.stone}">●</span> ${t('tenant.reports.previous')} (${periodLabel(pp.period, prev.granularity)}): ${fmt(metric.value, before[i] ?? 0)}`,
          );
        }
        return lines.join('<br/>');
      },
    },
    xAxis: { ...axisStyle.xAxis, boundaryGap: false, data: labels },
    yAxis: { ...axisStyle.yAxis, minInterval: money ? undefined : 1 },
    series: [
      lineSeries(t('tenant.reports.current'), now.map(show), chartColors.brand, { area: true }),
      lineSeries(t('tenant.reports.previous'), before.map(show), chartColors.stone, {
        dashed: true,
      }),
    ],
  };
});

// Excel needs the byte-order mark to open accents correctly.
const BOM = String.fromCharCode(0xfeff);

function download() {
  if (!current.value) return;
  const headers = Object.fromEntries(metrics.map((m) => [m, labelOf(m)])) as Record<Metric, string>;
  const csv = toCsv(current.value.series, headers, t('tenant.reports.range'));
  const url = URL.createObjectURL(new Blob([`${BOM}${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `ignis-reporte-${range.value.from}_${range.value.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.reports') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.reports.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.reports.intro') }}</p>
    </div>

    <div class="ig-card q-pa-md q-mb-md">
      <div class="row q-col-gutter-md items-end">
        <div class="col-12 col-md-auto">
          <div class="ig-eyebrow q-mb-xs">{{ t('tenant.reports.range') }}</div>
          <div class="ig-scroll-x">
            <IgSegmented
              v-model="preset"
              :label="t('tenant.reports.range')"
              :options="[
                { value: 7, label: t('tenant.overview.period.7') },
                { value: 30, label: t('tenant.overview.period.30') },
                { value: 90, label: t('tenant.overview.period.90') },
                { value: 'custom', label: t('tenant.reports.custom') },
              ]"
            />
          </div>
        </div>
        <div class="col-12 col-sm-6 col-md-auto">
          <IgButton
            variant="secondary"
            icon="event"
            block
            :label="`${longDate(range.from)} – ${longDate(range.to)}`"
          >
            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
              <q-date
                :model-value="{
                  from: range.from.replaceAll('-', '/'),
                  to: range.to.replaceAll('-', '/'),
                }"
                range
                minimal
                first-day-of-week="1"
                color="primary"
                text-color="white"
                @update:model-value="pick"
              >
                <div class="row justify-end">
                  <IgButton v-close-popup variant="ghost" size="sm" :label="t('common.close')" />
                </div>
              </q-date>
            </q-popup-proxy>
          </IgButton>
        </div>
        <div class="col-12 col-sm-6 col-md-auto">
          <IgSegmented
            v-model="granularity"
            block
            :label="t('tenant.reports.granularity.day')"
            :options="[
              { value: 'day', label: t('tenant.reports.granularity.day') },
              { value: 'week', label: t('tenant.reports.granularity.week') },
            ]"
          />
        </div>
        <div class="col-12 col-md text-md-right">
          <IgButton
            variant="ghost"
            icon="download"
            :disable="!current"
            :label="t('common.export')"
            @click="download"
          />
        </div>
      </div>
      <div class="text-caption ig-muted q-mt-md">
        {{
          t('tenant.reports.comparing', {
            from: longDate(range.from),
            to: longDate(range.to),
            pfrom: longDate(prevRange.from),
            pto: longDate(prevRange.to),
          })
        }}
      </div>
      <IgAlert v-if="rangeError" tone="error" class="q-mt-sm">{{ rangeError }}</IgAlert>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <div class="ig-card q-pa-md q-mb-md">
      <div class="ig-scroll-x q-mb-md">
        <IgSegmented
          v-model="metric"
          :label="t('tenant.reports.metric')"
          :options="metrics.map((m) => ({ value: m, label: labelOf(m) }))"
        />
      </div>
      <q-skeleton v-if="loading && !current" height="320px" />
      <EChart v-else :option="chartOption" :height="320" :label="labelOf(metric)" />
    </div>

    <div class="ig-card" style="overflow: hidden">
      <div class="ig-section-title q-pa-md q-pb-sm">{{ t('tenant.reports.table.title') }}</div>
      <button
        v-for="r in rows"
        :key="r.metric"
        type="button"
        class="ig-row"
        :aria-current="metric === r.metric"
        @click="metric = r.metric"
      >
        <div class="col">
          <div class="text-weight-medium">{{ labelOf(r.metric) }}</div>
          <div class="text-caption ig-muted">
            {{ t('tenant.reports.previous') }}: {{ fmt(r.metric, r.before) }}
          </div>
        </div>
        <div class="text-right">
          <div class="text-subtitle1 text-weight-bold ig-num">{{ fmt(r.metric, r.now) }}</div>
          <span
            class="ig-delta"
            :class="
              r.delta === null || r.delta === 0
                ? 'ig-delta--flat'
                : r.delta > 0
                  ? 'ig-delta--good'
                  : 'ig-delta--bad'
            "
          >
            {{ formatChange(r.delta) }}
          </span>
        </div>
      </button>
    </div>
  </q-page>
</template>
