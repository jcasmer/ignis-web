<script setup lang="ts">
import { useId } from 'vue';

// The mark: a flame in a diamond, in the ember. One gradient id per instance, so a hidden copy
// of the mark never breaks another one.
withDefaults(defineProps<{ size?: number }>(), { size: 36 });
const id = useId();
</script>

<template>
  <div class="row items-center no-wrap q-gutter-x-sm" role="img" aria-label="Ignis">
    <svg :width="size" :height="size" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient :id="`mark-${id}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff7a2f" />
          <stop offset="1" stop-color="#e8590c" />
        </linearGradient>
      </defs>
      <path d="M20 2 38 20 20 38 2 20Z" :fill="`url(#mark-${id})`" />
      <path
        d="M20 10c1 5 7 7 7 13a7 7 0 0 1-14 0c0-3 2-4.600 3-6.500.700 1.500 1.600 2.200 2.500 2.500C18 16 19 13 20 10Z"
        fill="#ffffff"
      />
    </svg>
    <span class="text-h6 text-weight-bold" style="letter-spacing: -0.02em">ignis</span>
  </div>
</template>
