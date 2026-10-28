<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import IgAlert from '@/components/IgAlert.vue';
import { ApiError } from '@/api/http';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();

// The link carries the token in the address; take it into memory and remove it
// from the address bar and the history so it is not left behind.
const token = typeof route.query.token === 'string' ? route.query.token : '';
if (token) void router.replace({ path: route.path, query: {} });

type State = 'working' | 'done' | 'taken' | 'invalid';
const state = ref<State>(token ? 'working' : 'invalid');

onMounted(async () => {
  if (!token) return;
  try {
    await session.api.confirmEmail(token);
    state.value = 'done';
  } catch (e) {
    state.value = e instanceof ApiError && e.status === 409 ? 'taken' : 'invalid';
  }
});
</script>

<template>
  <div class="q-gutter-y-md">
    <h1 class="text-h5 text-weight-bold q-my-none">{{ t('auth.confirmEmail.title') }}</h1>
    <q-skeleton v-if="state === 'working'" height="48px" />
    <IgAlert v-else-if="state === 'done'" tone="success">{{ t('auth.confirmEmail.done') }}</IgAlert>
    <IgAlert v-else-if="state === 'taken'" tone="error">{{ t('auth.confirmEmail.taken') }}</IgAlert>
    <IgAlert v-else tone="error">{{ t('auth.confirmEmail.invalid') }}</IgAlert>
    <div class="text-center">
      <router-link to="/login" class="text-body2">{{ t('auth.signIn') }}</router-link>
    </div>
  </div>
</template>
