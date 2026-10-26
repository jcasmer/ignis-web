<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ tone?: 'error' | 'success' | 'info' | 'warn' }>(), {
  tone: 'info',
});

const icon = computed(
  () =>
    ({ error: 'error_outline', success: 'check_circle', info: 'info', warn: 'warning_amber' })[
      props.tone
    ],
);
// Errors interrupt; the others only inform.
const role = computed(() => (props.tone === 'error' ? 'alert' : 'status'));
</script>

<template>
  <div class="ig-alert" :class="`ig-alert--${tone}`" :role="role">
    <q-icon :name="icon" class="ig-alert__icon" aria-hidden="true" />
    <div class="ig-alert__body"><slot /></div>
    <div v-if="$slots.action" class="ig-alert__action"><slot name="action" /></div>
  </div>
</template>
