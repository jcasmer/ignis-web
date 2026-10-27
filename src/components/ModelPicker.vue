<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ModelProvider } from '@/api/automations';
import { modelName, providerOptions as optionsOf } from '@/utils/models';

const props = defineProps<{
  /** The models that can be chosen, as "provider:model". */
  models: string[];
  /** Every provider of the platform and whether it can be chosen; without it, those of the models. */
  providers?: ModelProvider[];
  /** What choosing nothing means, e.g. "the model of the plan". */
  defaultLabel: string;
  label?: string;
}>();
const value = defineModel<string>({ required: true });
const { t } = useI18n();

// A model that is saved but no longer offered stays visible, so it is not lost silently.
const all = computed(() =>
  value.value && !props.models.includes(value.value)
    ? [...props.models, value.value]
    : props.models,
);
const provider = computed(() => value.value.split(':', 1)[0] ?? '');
const providerOptions = computed(() => [
  { value: '', label: props.defaultLabel, disable: false },
  ...optionsOf(props.providers ?? [], all.value, provider.value, {
    available: '',
    not_configured: t('models.notConfigured'),
    no_price: t('models.noPrice'),
  }),
]);
const modelOptions = computed(() =>
  all.value
    .filter((m) => m.startsWith(`${provider.value}:`))
    .map((m) => ({ value: m, label: modelName(m) })),
);

function pickProvider(p: string) {
  // Choosing a provider picks its first model, so the value is always complete.
  value.value = p ? (all.value.find((m) => m.startsWith(`${p}:`)) ?? '') : '';
}
</script>

<template>
  <div class="row q-col-gutter-sm">
    <div class="col-12 col-sm-5">
      <q-select
        behavior="menu"
        popup-content-class="ig-menu"
        :model-value="provider"
        dense
        outlined
        emit-value
        map-options
        :options="providerOptions"
        :label="t('models.provider')"
        @update:model-value="pickProvider"
      />
    </div>
    <div class="col-12 col-sm-7">
      <q-select
        behavior="menu"
        popup-content-class="ig-menu"
        v-model="value"
        dense
        outlined
        emit-value
        map-options
        :disable="!provider"
        :options="modelOptions"
        :label="label ?? t('models.model')"
        :hint="provider ? '' : t('models.pickProviderFirst')"
      />
    </div>
  </div>
</template>
