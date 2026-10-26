<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { useApiError } from '@/composables/useApiError';
import { useSessionStore } from '@/stores/session';
import IgButton from '@/components/IgButton.vue';
import IgAlert from '@/components/IgAlert.vue';

const { t } = useI18n();
const route = useRoute();
const session = useSessionStore();
const describe = useApiError();

const area = route.meta.area ?? 'tenant';
const prefix = area === 'ops' ? '/admin' : '';

const email = ref('');
const busy = ref(false);
const sent = ref(false);
const error = ref('');

const emailRule = (v: string) => /^\S+@\S+\.\S+$/.test(v) || t('auth.errors.email');

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await session.api.forgot(area, email.value.trim());
    sent.value = true; // the same answer whether or not the account exists.
  } catch (e) {
    error.value = describe(e, 'other');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <q-form class="q-gutter-y-md" @submit.prevent="submit">
    <div>
      <h1 class="text-h5 text-weight-bold q-my-none">{{ t('auth.forgotPage.title') }}</h1>
      <p class="ig-muted q-mt-xs q-mb-none">{{ t('auth.forgotPage.subtitle') }}</p>
    </div>

    <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>
    <IgAlert v-if="sent" tone="success">{{ t('auth.forgotPage.sent') }}</IgAlert>

    <template v-if="!sent">
      <q-input
        v-model="email"
        type="email"
        autocomplete="username"
        :label="t('common.email')"
        outlined
        autofocus
        :rules="[emailRule]"
        lazy-rules="ondemand"
      />
      <IgButton
        type="submit"
        variant="primary"
        block
        :label="t('auth.forgotPage.send')"
        :loading="busy"
      />
    </template>

    <div class="text-center">
      <router-link :to="`${prefix}/login`" class="text-body2">{{ t('common.back') }}</router-link>
    </div>
  </q-form>
</template>
