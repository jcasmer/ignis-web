<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import WhatsAppTemplatesPanel from '@/components/WhatsAppTemplatesPanel.vue';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const session = useSessionStore();
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.whatsapp') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('whatsapp.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('whatsapp.intro') }}</p>
    </div>
    <WhatsAppTemplatesPanel :client="session.data.whatsapp" />
  </q-page>
</template>
