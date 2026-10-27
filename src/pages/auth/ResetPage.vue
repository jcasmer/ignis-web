<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { useApiError } from '@/composables/useApiError';
import { useSessionStore } from '@/stores/session';
import IgButton from '@/components/IgButton.vue';
import IgAlert from '@/components/IgAlert.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const describe = useApiError();

const area = route.meta.area ?? 'tenant';
// A new account arrives by /activate; the same page, with the words of a welcome.
const activating = route.path.endsWith('/activate');
const key = (k: string) => `auth.${activating ? 'activatePage' : 'resetPage'}.${k}`;
const prefix = area === 'ops' ? '/admin' : '';

// The link carries the token in the address; take it into memory and remove it
// from the address bar and the history so it is not left behind.
const token = ref(typeof route.query.token === 'string' ? route.query.token : '');
if (token.value) void router.replace({ path: route.path, query: {} });

const password = ref('');
const reveal = ref(false);
const busy = ref(false);
const done = ref(false);
const error = ref('');

const strong = (v: string) => v.length >= 12 || t('auth.resetPage.hint');

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await session.api.reset(area, token.value, password.value);
    password.value = '';
    token.value = '';
    done.value = true;
  } catch (e) {
    error.value = describe(e, 'password');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <q-form class="q-gutter-y-md" @submit.prevent="submit">
    <div>
      <h1 class="text-h5 text-weight-bold q-my-none">{{ t(key('title')) }}</h1>
      <p v-if="activating && !done" class="ig-muted q-mt-sm q-mb-none">
        {{ t('auth.activatePage.intro') }}
      </p>
    </div>

    <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>
    <IgAlert v-if="done" tone="success">{{ t(key('done')) }}</IgAlert>
    <IgAlert v-else-if="!token" tone="error">{{ t('auth.resetPage.missing') }}</IgAlert>

    <template v-if="!done && token">
      <q-input
        v-model="password"
        :type="reveal ? 'text' : 'password'"
        autocomplete="new-password"
        :label="t('auth.resetPage.newPassword')"
        :hint="t('auth.resetPage.hint')"
        outlined
        autofocus
        :rules="[strong]"
        lazy-rules="ondemand"
      >
        <template #append>
          <q-icon
            :name="reveal ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            role="button"
            tabindex="0"
            :aria-label="reveal ? t('common.hide') : t('common.show')"
            @click="reveal = !reveal"
            @keyup.enter="reveal = !reveal"
          />
        </template>
      </q-input>
      <IgButton type="submit" variant="primary" block :label="t(key('save'))" :loading="busy" />
    </template>

    <div class="text-center">
      <router-link :to="`${prefix}/login`" class="text-body2">
        {{ done ? t('auth.signIn') : t('common.back') }}
      </router-link>
    </div>
  </q-form>
</template>
