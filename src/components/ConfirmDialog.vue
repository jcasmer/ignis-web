<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import IgButton from '@/components/IgButton.vue';

const props = defineProps<{
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  /** An action that cannot be undone is shown with care. */
  destructive?: boolean;
  /** For what cannot be undone at all: the person must type this word to go on. */
  typeToConfirm?: string;
  typeHint?: string;
}>();

const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ confirm: [] }>();

const typed = ref('');
// Every opening starts with an empty field.
watch(open, () => {
  typed.value = '';
});

const allowed = computed(
  () =>
    !props.typeToConfirm || typed.value.trim().toLowerCase() === props.typeToConfirm.toLowerCase(),
);
</script>

<template>
  <q-dialog v-model="open" :persistent="loading" position="standard">
    <q-card
      class="ig-card ig-card--raised"
      style="width: 440px; max-width: 94vw; border-radius: 20px"
    >
      <q-card-section>
        <div class="text-h6">{{ title }}</div>
        <p class="ig-muted q-mt-sm q-mb-none" style="white-space: pre-line">{{ message }}</p>
        <q-input
          v-if="typeToConfirm"
          v-model="typed"
          class="q-mt-md"
          outlined
          dense
          autocomplete="off"
          :label="typeHint ?? typeToConfirm"
          @keyup.enter="allowed && emit('confirm')"
        />
      </q-card-section>
      <q-card-actions align="right" class="q-pa-md q-gutter-x-sm">
        <IgButton variant="ghost" :disable="loading" :label="cancelLabel" @click="open = false" />
        <IgButton
          :variant="destructive ? 'secondary' : 'primary'"
          :class="{ 'ig-btn--danger': destructive }"
          :loading="loading"
          :disable="!allowed"
          :label="confirmLabel"
          @click="emit('confirm')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
