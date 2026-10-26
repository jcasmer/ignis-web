<script setup lang="ts">
import { computed } from 'vue';

import { formatChange } from '@/utils/stats';

const props = defineProps<{
  label: string;
  value: string;
  /** Fraction against the previous period; null when there is none. */
  delta?: number | null;
  /** True when a rise is bad news (it is shown in amber, never red). */
  lowerIsBetter?: boolean;
  icon?: string;
}>();

const trend = computed(() => {
  if (props.delta === null || props.delta === undefined || props.delta === 0) return 'flat';
  return props.delta > 0 ? 'up' : 'down';
});

const tone = computed(() => {
  if (trend.value === 'flat') return 'ig-muted';
  const good = props.lowerIsBetter ? trend.value === 'down' : trend.value === 'up';
  return good ? 'text-positive' : 'text-warning';
});
</script>

<template>
  <div class="ig-card q-pa-md full-height">
    <div class="row items-center no-wrap q-gutter-x-sm">
      <q-icon v-if="icon" :name="icon" size="20px" style="color: var(--ig-amber-700)" />
      <div class="text-caption ig-muted">{{ label }}</div>
    </div>
    <div class="text-h4 text-weight-bold q-mt-xs" style="font-variant-numeric: tabular-nums">
      {{ value }}
    </div>
    <div
      v-if="delta !== undefined"
      class="text-caption q-mt-xs row items-center"
      :class="tone"
      style="gap: 2px"
    >
      <template v-if="delta !== null">
        <q-icon
          :name="trend === 'up' ? 'arrow_upward' : trend === 'down' ? 'arrow_downward' : 'remove'"
          size="14px"
        />
        <span class="text-weight-medium">{{ formatChange(delta) }}</span>
        <span class="ig-muted q-ml-xs">{{ $t('common.vsPrevious') }}</span>
      </template>
      <span v-else class="ig-muted">{{ $t('common.noComparison') }}</span>
    </div>
  </div>
</template>
