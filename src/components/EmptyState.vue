<script setup lang="ts">
defineProps<{ icon: string; title: string; hint?: string }>();
</script>

<template>
  <div class="ig-empty">
    <div class="ig-empty__icon"><q-icon :name="icon" size="28px" /></div>
    <div class="text-subtitle1 text-weight-bold" style="color: var(--ig-text)">{{ title }}</div>
    <div v-if="hint" class="text-body2">{{ hint }}</div>
    <slot />
  </div>
</template>
