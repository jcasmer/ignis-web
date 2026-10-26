<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'md' | 'sm';
    label?: string;
    icon?: string;
    /** Icon only: a round button. Give it an `ariaLabel`. */
    iconOnly?: boolean;
    block?: boolean;
    loading?: boolean;
    disable?: boolean;
    type?: 'button' | 'submit';
    to?: string;
    ariaLabel?: string;
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
);

const classes = computed(() => [
  'ig-btn',
  `ig-btn--${props.variant}`,
  {
    'ig-btn--icon': props.iconOnly,
    'ig-btn--sm': props.size === 'sm',
    'ig-btn--block': props.block,
  },
]);
</script>

<template>
  <q-btn
    :class="classes"
    unelevated
    no-caps
    :ripple="false"
    :type="type"
    :to="to"
    :icon="icon"
    :label="iconOnly ? undefined : label"
    :loading="loading"
    :disable="disable"
    :aria-label="ariaLabel ?? (iconOnly ? label : undefined)"
  >
    <slot />
  </q-btn>
</template>
