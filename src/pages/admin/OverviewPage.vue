<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { useSessionStore } from '@/stores/session';
import EmptyState from '@/components/EmptyState.vue';

const { t } = useI18n();
const session = useSessionStore();
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('app.name') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('admin.overview.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('admin.overview.intro') }}</p>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-4">
        <div class="ig-card q-pa-lg row items-center no-wrap q-gutter-x-md">
          <span class="ig-avatar ig-avatar--lg">{{
            (session.operator?.name ?? 'I').charAt(0).toUpperCase()
          }}</span>
          <div>
            <div class="ig-eyebrow">{{ t('admin.overview.hello') }}</div>
            <div class="text-h6">{{ session.operator?.name }}</div>
            <span class="ig-pill ig-pill--brand">
              {{ session.operator ? t(`admin.roles.${session.operator.role}`) : '' }}
            </span>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-8">
        <div class="ig-card">
          <EmptyState icon="domain" :title="t('admin.overview.placeholder')" />
        </div>
      </div>
    </div>
  </q-page>
</template>
