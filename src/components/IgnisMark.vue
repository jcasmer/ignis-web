<script setup lang="ts">
// Placeholder mark until the logo is designed: an amber diamond and the name.
withDefaults(defineProps<{ size?: number }>(), { size: 36 });
</script>

<template>
  <div class="row items-center no-wrap q-gutter-x-sm" role="img" aria-label="Ignis">
    <svg :width="size" :height="size" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="ig-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffd166" />
          <stop offset="1" stop-color="#f2a900" />
        </linearGradient>
      </defs>
      <path d="M20 2 38 20 20 38 2 20Z" fill="url(#ig-g)" />
      <path d="M20 11 29 20 20 29 11 20Z" fill="#1b1a17" opacity=".9" />
    </svg>
    <span class="text-h6 text-weight-bold" style="letter-spacing: 0.02em">ignis</span>
  </div>
</template>
