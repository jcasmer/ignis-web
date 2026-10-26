<script setup lang="ts" generic="T extends string | number">
import { ref } from 'vue';

export interface SegmentOption<V> {
  value: V;
  label: string;
}

const props = defineProps<{ options: SegmentOption<T>[]; label: string; block?: boolean }>();
const model = defineModel<T>({ required: true });
const buttons = ref<HTMLButtonElement[]>([]);

// Arrow keys move the choice, as in any radio group.
function onKey(e: KeyboardEvent, index: number) {
  const step =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? -1
        : 0;
  if (!step) return;
  e.preventDefault();
  const next = (index + step + props.options.length) % props.options.length;
  model.value = props.options[next]!.value;
  buttons.value[next]?.focus();
}
</script>

<template>
  <div class="ig-seg" :class="{ 'ig-seg--block': block }" role="radiogroup" :aria-label="label">
    <button
      v-for="(o, i) in options"
      :key="String(o.value)"
      ref="buttons"
      type="button"
      role="radio"
      class="ig-seg__opt"
      :aria-checked="o.value === model"
      :tabindex="o.value === model ? 0 : -1"
      @click="model = o.value"
      @keydown="onKey($event, i)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
