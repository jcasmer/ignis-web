<script setup lang="ts">
import { computed, toRef } from 'vue';

import TrendLine from '@/components/TrendLine.vue';
import { useCountUp } from '@/composables/useCountUp';
import { formatChange, formatMicroUsd, formatNumber } from '@/utils/stats';

const props = defineProps<{
  label: string;
  value: number;
  /** How to write the figure: a count, or micro-dollars as money. */
  format?: 'number' | 'usd' | undefined;
  /** Fraction against the previous period; null when there is none. */
  delta?: number | null;
  /** True when a rise is bad news (it is shown in orange, never red). */
  lowerIsBetter?: boolean | undefined;
  icon?: string;
  /** The colour of the metric, the same in every chart. */
  color: string;
  spark?: number[];
  compareLabel: string;
  noCompareLabel: string;
}>();

const shown = useCountUp(toRef(props, 'value'));
const text = computed(() =>
  props.format === 'usd' ? formatMicroUsd(shown.value) : formatNumber(Math.round(shown.value)),
);

const trend = computed(() => {
  if (props.delta === null || props.delta === undefined || props.delta === 0) return 'flat';
  return props.delta > 0 ? 'up' : 'down';
});

const tone = computed(() => {
  if (trend.value === 'flat') return 'flat';
  const good = props.lowerIsBetter ? trend.value === 'down' : trend.value === 'up';
  return good ? 'good' : 'bad';
});
</script>

<template>
  <div class="ig-card ig-kpi" :style="{ '--kpi': color }">
    <div class="ig-kpi__head">
      <div v-if="icon" class="ig-kpi__icon"><q-icon :name="icon" /></div>
      <div class="ig-kpi__label">{{ label }}</div>
    </div>
    <div class="ig-kpi__value">{{ text }}</div>
    <div v-if="delta !== undefined" class="ig-kpi__foot">
      <template v-if="delta !== null">
        <span class="ig-delta" :class="`ig-delta--${tone}`">
          <q-icon
            :name="trend === 'up' ? 'north_east' : trend === 'down' ? 'south_east' : 'remove'"
          />
          {{ formatChange(delta) }}
        </span>
        <span>{{ compareLabel }}</span>
      </template>
      <span v-else>{{ noCompareLabel }}</span>
    </div>
    <div v-if="spark && spark.length > 1" class="ig-kpi__spark">
      <TrendLine :values="spark" :label="label" :color="color" />
    </div>
  </div>
</template>
