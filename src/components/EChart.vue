<script setup lang="ts">
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { Dark } from 'quasar';
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const props = withDefaults(
  defineProps<{ option: echarts.EChartsCoreOption; height?: number; label: string }>(),
  {
    height: 280,
  },
);

const el = ref<HTMLDivElement | null>(null);
const chart = shallowRef<echarts.ECharts | null>(null);
let observer: ResizeObserver | null = null;

const css = (name: string) => getComputedStyle(document.body).getPropertyValue(name).trim();

/** Theme from the design tokens, so charts follow light and dark like the rest. */
function themed(option: echarts.EChartsCoreOption): echarts.EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: css('--ig-muted'), fontFamily: 'inherit' },
    animationDuration: 400,
    tooltip: {
      backgroundColor: css('--ig-surface'),
      borderColor: css('--ig-line'),
      textStyle: { color: css('--ig-text') },
    },
    ...option,
  };
}

function draw() {
  chart.value?.setOption(themed(props.option), true);
}

onMounted(() => {
  if (!el.value) return;
  chart.value = markRaw(echarts.init(el.value, undefined, { renderer: 'canvas' }));
  draw();
  observer = new ResizeObserver(() => chart.value?.resize());
  observer.observe(el.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  chart.value?.dispose();
});

watch(() => props.option, draw, { deep: true });
watch(
  () => Dark.isActive,
  () => setTimeout(draw, 0),
);
</script>

<template>
  <div ref="el" role="img" :aria-label="label" :style="{ height: `${height}px`, width: '100%' }" />
</template>
