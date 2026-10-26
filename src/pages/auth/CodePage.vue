<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import type { MfaSetup } from '@/api/auth';
import QrCode from '@/components/QrCode.vue';
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
const setupMode = session.step === 'mfa_setup';

const code = ref('');
const recovery = ref(false);
const busy = ref(false);
const error = ref('');
const setup = ref<MfaSetup | null>(null);

function restart() {
  void router.replace(`${prefix}/login`);
}

onMounted(async () => {
  // A reload loses the challenge on purpose: start again from the password.
  if (!session.step) return restart();
  if (setupMode) {
    try {
      setup.value = await session.beginSetup();
    } catch (e) {
      error.value = describe(e, 'other');
    }
  }
});

const sixDigits = (v: string) => /^\d{6}$/.test(v.replace(/\s/g, '')) || t('auth.errors.code');
const required = (v: string) => !!v.trim() || t('auth.errors.required');

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const value = code.value.replace(/\s/g, '');
    if (setupMode) await session.confirmSetup(value);
    else await session.verify(recovery.value ? code.value.trim() : value);
    await router.replace(home[area]);
  } catch (e) {
    error.value = describe(e, 'code');
    code.value = '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <q-form class="q-gutter-y-md" @submit.prevent="submit">
    <div>
      <h1 class="text-h5 text-weight-bold q-my-none">
        {{ setupMode ? t('auth.setup.title') : t('auth.code.title') }}
      </h1>
      <p class="ig-muted q-mt-xs q-mb-none">
        {{ setupMode ? t('auth.setup.subtitle') : t('auth.code.subtitle') }}
      </p>
    </div>

    <q-banner v-if="error" role="alert" rounded class="bg-negative text-white" dense>{{
      error
    }}</q-banner>

    <div v-if="setupMode && setup" class="column items-center q-gutter-y-sm">
      <QrCode :value="setup.uri" label="QR" />
      <div class="text-caption ig-muted">{{ t('auth.setup.manual') }}</div>
      <div class="ig-code text-body2" style="word-break: break-all; text-align: center">
        {{ setup.secret }}
      </div>
    </div>

    <q-input
      v-if="!recovery"
      v-model="code"
      class="ig-otp"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="7"
      :label="t('auth.code.label')"
      outlined
      autofocus
      :rules="[sixDigits]"
      lazy-rules="ondemand"
    />
    <q-input
      v-else
      v-model="code"
      class="ig-code"
      autocomplete="off"
      :label="t('auth.code.recoveryLabel')"
      outlined
      autofocus
      :rules="[required]"
      lazy-rules="ondemand"
    />

    <q-btn
      type="submit"
      class="ig-btn-primary full-width"
      unelevated
      no-caps
      size="lg"
      :label="t('common.continue')"
      :loading="busy"
    />

    <div class="row justify-between items-center">
      <q-btn
        flat
        no-caps
        dense
        size="sm"
        icon="arrow_back"
        :label="t('common.back')"
        @click="restart"
      />
      <q-btn
        v-if="!setupMode"
        flat
        no-caps
        dense
        size="sm"
        :label="recovery ? t('auth.code.useApp') : t('auth.code.useRecovery')"
        @click="((recovery = !recovery), (code = ''))"
      />
    </div>
  </q-form>
</template>
