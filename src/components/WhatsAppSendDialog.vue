<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { WhatsAppTemplate } from '@/api/whatsapp';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { paramProblem, preview, validPhone, variablesOf } from '@/utils/whatsapp';

const props = defineProps<{
  template: WhatsAppTemplate | null;
  sending: boolean;
  error: string;
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ send: [to: string, params: string[]] }>();
const { t } = useI18n();

const to = ref('');
const values = ref<string[]>([]);
const touched = ref(false);

watch(open, (isOpen) => {
  if (!isOpen) return;
  to.value = '';
  touched.value = false;
  values.value = (props.template ? variablesOf(props.template.body) : []).map(() => '');
});

const count = computed(() => values.value.length);
const phoneOk = computed(() => validPhone(to.value));
const problems = computed(() => values.value.map((v) => paramProblem(v)));
const valid = computed(() => phoneOk.value && problems.value.every((p) => p === null));
const shown = computed(() => (props.template ? preview(props.template.body, values.value) : ''));

function submit() {
  touched.value = true;
  if (!valid.value || props.sending) return;
  emit('send', to.value.trim(), values.value);
}
</script>

<template>
  <q-dialog v-model="open" persistent>
    <q-card
      class="ig-card ig-card--raised"
      style="width: 520px; max-width: 94vw; border-radius: 20px"
    >
      <form class="q-pa-lg column q-gutter-y-md" @submit.prevent="submit">
        <div class="row items-center no-wrap">
          <div class="col text-h6">{{ t('whatsapp.send.title') }}</div>
          <IgButton
            variant="ghost"
            size="sm"
            icon-only
            icon="close"
            :aria-label="t('common.cancel')"
            :disable="sending"
            @click="open = false"
          />
        </div>
        <p class="ig-muted q-my-none">{{ t('whatsapp.send.intro') }}</p>
        <q-input
          v-model="to"
          outlined
          inputmode="numeric"
          :label="t('whatsapp.send.to')"
          :hint="t('whatsapp.send.toHint')"
          :error="touched && !phoneOk"
          :error-message="t('whatsapp.send.toProblem')"
        />
        <q-input
          v-for="(_, i) in count"
          :key="i"
          v-model="values[i]"
          outlined
          dense
          :label="t('whatsapp.send.valueOf', { n: i + 1 })"
          :error="touched && problems[i] !== null"
          :error-message="problems[i] ? t(`whatsapp.send.problem.${problems[i]}`) : ''"
        />
        <div>
          <div class="text-caption ig-muted q-mb-xs">{{ t('whatsapp.form.preview') }}</div>
          <div class="ig-send-preview">{{ shown }}</div>
        </div>
        <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>
        <div class="row q-gutter-sm">
          <IgButton
            variant="ghost"
            :label="t('common.cancel')"
            :disable="sending"
            @click="open = false"
          />
          <IgButton
            type="submit"
            variant="primary"
            icon="send"
            :label="t('whatsapp.send.submit')"
            :loading="sending"
          />
        </div>
      </form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.ig-send-preview {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ig-surface-2, rgba(127, 127, 127, 0.1));
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9rem;
  line-height: 1.45;
}
</style>
