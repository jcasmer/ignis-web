<script setup lang="ts">
import { copyToClipboard, useQuasar } from 'quasar';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSessionStore } from '@/stores/session';
import IgButton from '@/components/IgButton.vue';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const open = computed(() => (session.recoveryCodes?.length ?? 0) > 0);

async function copy() {
  await copyToClipboard((session.recoveryCodes ?? []).join('\n'));
  $q.notify({ type: 'positive', message: t('common.copied'), timeout: 1500 });
}
</script>

<template>
  <q-dialog :model-value="open" persistent>
    <q-card
      class="ig-card ig-card--raised"
      style="width: 460px; max-width: 95vw; border-radius: 20px"
    >
      <q-card-section class="q-pb-none">
        <div class="ig-avatar ig-avatar--lg q-mb-md" style="border-radius: 14px">
          <q-icon name="key" />
        </div>
        <div class="text-h6">{{ t('auth.recovery.title') }}</div>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('auth.recovery.body') }}</p>
      </q-card-section>
      <q-card-section>
        <div class="row q-col-gutter-sm">
          <div v-for="code in session.recoveryCodes" :key="code" class="col-6">
            <div
              class="ig-code text-center q-pa-sm"
              style="
                background: var(--ig-surface-2);
                border: 1px dashed var(--ig-line-strong);
                border-radius: 10px;
              "
            >
              {{ code }}
            </div>
          </div>
        </div>
      </q-card-section>
      <q-card-actions align="between" class="q-pa-md">
        <IgButton variant="secondary" icon="content_copy" :label="t('common.copy')" @click="copy" />
        <IgButton
          variant="primary"
          :label="t('auth.recovery.saved')"
          @click="session.dismissRecoveryCodes()"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
