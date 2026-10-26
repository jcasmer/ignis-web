<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AutomationsPanel from '@/components/AutomationsPanel.vue';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const session = useSessionStore();

const loadConnectors = async () => (await session.data.connectors()).items;
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.automations') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.automations.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.automations.intro') }}</p>
    </div>
    <AutomationsPanel :client="session.data.automations" :load-connectors="loadConnectors" />
  </q-page>
</template>
