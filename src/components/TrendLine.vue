<script setup lang="ts">
import { computed, useId } from 'vue';

const props = defineProps<{ values: number[]; label: string }>();
const id = useId();

const W = 160;
const H = 44;
const PAD = 4;

// Smooth path through the points (Catmull-Rom turned into cubic Béziers).
const geometry = computed(() => {
  const v = props.values;
  if (v.length < 2) return null;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const pts = v.map((y, i) => ({
    x: (i / (v.length - 1)) * W,
    y: H - PAD - ((y - min) / span) * (H - PAD * 2),
  }));
  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  const last = pts[pts.length - 1]!;
  return { line: d, area: `${d} L${last.x},${H} L0,${H} Z`, last };
});
</script>

<template>
  <svg
    v-if="geometry"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="none"
    width="100%"
    :height="H"
    role="img"
    :aria-label="label"
  >
    <defs>
      <linearGradient :id="`sp-${id}`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color: var(--ig-brand-500)" stop-opacity="0.34" />
        <stop offset="1" style="stop-color: var(--ig-brand-500)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="geometry.area" :fill="`url(#sp-${id})`" />
    <path
      :d="geometry.line"
      fill="none"
      stroke="var(--ig-brand-500)"
      stroke-width="2"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
