<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import IgnisMark from '@/components/IgnisMark.vue';
import { toggleTheme } from '@/composables/useTheme';

const { t } = useI18n();
const route = useRoute();
const isOps = computed(() => route.meta.area === 'ops');
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <main class="ig-auth">
        <div class="column items-center full-width">
          <div class="q-mb-lg"><IgnisMark :size="44" /></div>
          <div class="ig-card ig-auth__card">
            <router-view />
          </div>
          <div class="q-mt-lg row items-center q-gutter-x-md">
            <router-link :to="isOps ? '/login' : '/admin/login'" class="text-caption">
              {{ isOps ? t('auth.toTenant') : t('auth.toAdmin') }}
            </router-link>
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="contrast"
              :aria-label="t('common.theme')"
              @click="toggleTheme"
            />
          </div>
        </div>
      </main>
    </q-page-container>
  </q-layout>
</template>
