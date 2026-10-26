<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import IgButton from '@/components/IgButton.vue';

const { t } = useI18n();
</script>

<template>
  <main class="ig-auth">
    <div class="column items-center text-center q-gutter-y-md">
      <div
        style="
          font-size: 6rem;
          font-weight: 800;
          letter-spacing: -0.05em;
          line-height: 1;
          color: var(--ig-brand-500);
        "
      >
        404
      </div>
      <div class="text-h6">{{ t('notFound.title') }}</div>
      <IgButton variant="primary" to="/" :label="t('notFound.home')" />
    </div>
  </main>
</template>
