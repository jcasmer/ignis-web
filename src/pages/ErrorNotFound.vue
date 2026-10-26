<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <main class="ig-auth">
    <div class="column items-center text-center q-gutter-y-md">
      <div class="text-h1 text-weight-bold" style="color: var(--ig-amber-500)">404</div>
      <div class="text-h6">{{ t('notFound.title') }}</div>
      <q-btn class="ig-btn-primary" unelevated no-caps to="/" :label="t('notFound.home')" />
    </div>
  </main>
</template>
