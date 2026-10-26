<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const session = useSessionStore();
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <h1 class="text-h4 text-weight-bold q-my-none">{{ t('tenant.overview.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.overview.intro') }}</p>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-4">
        <div class="ig-card q-pa-lg">
          <div class="text-caption ig-muted">{{ t('tenant.overview.role') }}</div>
          <div class="text-h6">
            {{ session.tenant ? t(`tenant.roles.${session.tenant.role}`) : '' }}
          </div>
        </div>
      </div>
      <div class="col-12 col-md-8">
        <div class="ig-card q-pa-lg ig-muted">{{ t('tenant.overview.placeholder') }}</div>
      </div>
    </div>
  </q-page>
</template>
