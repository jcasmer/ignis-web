import { chartColors } from '@/utils/palette';

/**
 * Building blocks for the charts, so every one of them has the same look:
 * soft gradients, round line ends, dotted guides, no axis chrome.
 */

export function gradient(color: string, from = 0.32, to = 0) {
  const hex = (a: number) =>
    Math.round(a * 255)
      .toString(16)
      .padStart(2, '0');
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `${color}${hex(from)}` },
      { offset: 1, color: `${color}${hex(to)}` },
    ],
  };
}

export const axisStyle = {
  xAxis: {
    type: 'category' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { fontSize: 11, margin: 12, hideOverlap: true },
  },
  yAxis: {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { fontSize: 11 },
    splitLine: { lineStyle: { color: '#8884', type: [3, 5] as number[] } },
  },
};

export const tooltipBox = {
  padding: [10, 14],
  extraCssText:
    'border-radius:12px;box-shadow:0 12px 32px -8px rgb(0 0 0 / 35%);backdrop-filter:blur(8px)',
  borderWidth: 1,
  axisPointer: { lineStyle: { color: chartColors.amber, width: 1, type: 'dashed' as const } },
};

export function lineSeries(
  name: string,
  data: number[],
  color: string,
  opts: { area?: boolean; dashed?: boolean } = {},
) {
  return {
    name,
    type: 'line' as const,
    data,
    smooth: 0.35,
    showSymbol: false,
    symbolSize: 8,
    lineStyle: {
      width: opts.dashed ? 2 : 3,
      color,
      cap: 'round' as const,
      type: opts.dashed ? ('dashed' as const) : ('solid' as const),
    },
    itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
    emphasis: { focus: 'series' as const },
    ...(opts.area ? { areaStyle: { color: gradient(color) } } : {}),
  };
}

export function barSeries(name: string, data: number[], color: string) {
  return {
    name,
    type: 'bar' as const,
    data,
    barMaxWidth: 18,
    itemStyle: { borderRadius: [6, 6, 2, 2], color: gradient(color, 1, 0.55) },
    emphasis: { itemStyle: { color } },
  };
}

export const legendStyle = {
  top: 0,
  icon: 'circle',
  itemWidth: 8,
  itemHeight: 8,
  itemGap: 18,
  textStyle: { fontSize: 12 },
};
