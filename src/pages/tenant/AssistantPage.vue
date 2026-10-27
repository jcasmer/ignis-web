<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AssistantProfilePanel from '@/components/AssistantProfilePanel.vue';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const session = useSessionStore();
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.assistant') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('assistant.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('assistant.intro') }}</p>
    </div>
    <AssistantProfilePanel :client="session.data.assistant" />
  </q-page>
</template>
