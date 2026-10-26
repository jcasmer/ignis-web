<script setup lang="ts">
import { useId } from 'vue';

// Placeholder mark until the logo is designed: a teal diamond and the name.
withDefaults(defineProps<{ size?: number }>(), { size: 36 });
// One gradient id per instance: a hidden copy of the mark must not break the other.
const id = useId();
</script>

<template>
  <div class="row items-center no-wrap q-gutter-x-sm" role="img" aria-label="Ignis">
    <svg :width="size" :height="size" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient :id="`mark-${id}`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#22b5a6" />
          <stop offset="1" stop-color="#0a645c" />
        </linearGradient>
      </defs>
      <path d="M20 2 38 20 20 38 2 20Z" :fill="`url(#mark-${id})`" />
      <path d="M20 11 29 20 20 29 11 20Z" fill="#ffffff" opacity=".92" />
    </svg>
    <span class="text-h6 text-weight-bold" style="letter-spacing: -0.02em">ignis</span>
  </div>
</template>
