<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { useApiError } from '@/composables/useApiError';
import { home } from '@/router/routes';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const describe = useApiError();

const area = route.meta.area ?? 'tenant';
const prefix = area === 'ops' ? '/admin' : '';

const email = ref('');
const password = ref('');
const reveal = ref(false);
const busy = ref(false);
const error = ref('');

const required = (v: string) => !!v || t('auth.errors.required');
const emailRule = (v: string) => /^\S+@\S+\.\S+$/.test(v) || t('auth.errors.email');

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const outcome = await session.signIn(area, email.value.trim(), password.value);
    password.value = '';
    await router.replace(outcome === 'session' ? home[area] : `${prefix}/code`);
  } catch (e) {
    error.value = describe(e, 'login');
    password.value = '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <q-form class="q-gutter-y-md" @submit.prevent="submit">
    <div>
      <h1 class="text-h5 text-weight-bold q-my-none">{{ t(`auth.${area}.title`) }}</h1>
      <p class="ig-muted q-mt-xs q-mb-none">{{ t(`auth.${area}.subtitle`) }}</p>
    </div>

    <q-banner v-if="error" role="alert" rounded class="bg-negative text-white" dense>{{
      error
    }}</q-banner>

    <q-input
      v-model="email"
      type="email"
      autocomplete="username"
      :label="t('common.email')"
      outlined
      autofocus
      :rules="[required, emailRule]"
      lazy-rules="ondemand"
    />
    <q-input
      v-model="password"
      :type="reveal ? 'text' : 'password'"
      autocomplete="current-password"
      :label="t('common.password')"
      outlined
      :rules="[required]"
      lazy-rules="ondemand"
    >
      <template #append>
        <q-icon
          :name="reveal ? 'visibility_off' : 'visibility'"
          class="cursor-pointer"
          role="button"
          tabindex="0"
          @click="reveal = !reveal"
          @keyup.enter="reveal = !reveal"
        />
      </template>
    </q-input>

    <q-btn
      type="submit"
      class="ig-btn-primary full-width"
      unelevated
      no-caps
      size="lg"
      :label="t('auth.signIn')"
      :loading="busy"
    />

    <div class="text-center">
      <router-link :to="`${prefix}/forgot`" class="text-caption">{{
        t('auth.forgot')
      }}</router-link>
    </div>
  </q-form>
</template>
