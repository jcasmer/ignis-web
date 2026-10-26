<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import KnowledgePanel from '@/components/KnowledgePanel.vue';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const session = useSessionStore();
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.knowledge') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.knowledge.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.knowledge.intro') }}</p>
    </div>
    <KnowledgePanel :client="session.data.knowledge" />
  </q-page>
</template>
