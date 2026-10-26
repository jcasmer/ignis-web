<script setup lang="ts">
import IgButton from '@/components/IgButton.vue';

defineProps<{
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  /** An action that cannot be undone is shown with care. */
  destructive?: boolean;
}>();

const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ confirm: [] }>();
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
      </q-card-section>
      <q-card-actions align="right" class="q-pa-md q-gutter-x-sm">
        <IgButton variant="ghost" :disable="loading" :label="cancelLabel" @click="open = false" />
        <IgButton
          :variant="destructive ? 'secondary' : 'primary'"
          :class="{ 'ig-btn--danger': destructive }"
          :loading="loading"
          :label="confirmLabel"
          @click="emit('confirm')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
