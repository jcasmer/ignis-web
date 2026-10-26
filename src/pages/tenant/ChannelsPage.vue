<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ApiError } from '@/api/http';
import type { Channel, ChannelName } from '@/api/tenant';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const NAMES: ChannelName[] = ['whatsapp', 'instagram', 'facebook'];
const ICONS: Record<ChannelName, string> = {
  whatsapp: 'chat',
  instagram: 'photo_camera',
  facebook: 'groups',
};

const channels = ref<Channel[]>([]);
const loading = ref(true);
const failed = ref(false);

const editing = ref<ChannelName | null>(null);
const account = ref('');
const token = ref('');
const reveal = ref(false);
const saving = ref(false);
const formError = ref('');

const open = computed({
  get: () => editing.value !== null,
  set: (v) => {
    if (!v) close();
  },
});

const byName = (n: ChannelName) => channels.value.find((c) => c.channel === n);
const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    channels.value = (await session.data.channels()).items;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function edit(n: ChannelName) {
  editing.value = n;
  account.value = byName(n)?.external_account_id ?? '';
  token.value = '';
  reveal.value = false;
  formError.value = '';
}

// The token is dropped from memory as soon as the form closes.
function close() {
  editing.value = null;
  token.value = '';
}

async function save() {
  const n = editing.value;
  if (!n) return;
  formError.value = '';
  if (!account.value.trim() || !token.value.trim()) {
    formError.value = t('auth.errors.required');
    return;
  }
  saving.value = true;
  try {
    const saved = await session.data.configureChannel(n, {
      external_account_id: account.value.trim(),
      access_token: token.value.trim(),
    });
    channels.value = [...channels.value.filter((c) => c.channel !== n), saved];
    close();
    $q.notify({ type: 'positive', message: t('tenant.channels.saved') });
  } catch (e) {
    formError.value =
      e instanceof ApiError && e.status === 403
        ? t('tenant.channels.notIncluded')
        : t('common.loadError');
  } finally {
    saving.value = false;
    token.value = '';
  }
}
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.channels') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.channels.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.channels.intro') }}</p>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <div class="row q-col-gutter-md">
      <div v-for="n in NAMES" :key="n" class="col-12 col-md-4">
        <div class="ig-card q-pa-lg full-height column no-wrap">
          <div class="row items-center no-wrap q-mb-md">
            <div class="ig-doc__icon q-mr-md"><q-icon :name="ICONS[n]" size="24px" /></div>
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">
                {{ t(`tenant.channels.names.${n}`) }}
              </div>
              <q-skeleton v-if="loading" width="90px" height="20px" />
              <span
                v-else
                class="ig-pill"
                :class="{ 'ig-pill--ok': byName(n)?.status === 'active' }"
              >
                {{
                  !byName(n)
                    ? t('tenant.channels.notConnected')
                    : byName(n)!.status === 'active'
                      ? t('tenant.channels.connected')
                      : t('tenant.channels.disabled')
                }}
              </span>
            </div>
          </div>
          <div v-if="byName(n)" class="text-body2 q-mb-md">
            <div class="ig-muted text-caption">{{ t('tenant.channels.account') }}</div>
            <div class="ig-code ellipsis">{{ byName(n)!.external_account_id }}</div>
            <div class="ig-muted text-caption q-mt-sm">
              {{ t('tenant.channels.updated') }} {{ when(byName(n)!.updated_at) }}
            </div>
          </div>
          <div class="q-mt-auto">
            <IgButton
              :variant="byName(n) ? 'secondary' : 'primary'"
              block
              :disable="loading"
              :label="byName(n) ? t('tenant.channels.update') : t('tenant.channels.connect')"
              @click="edit(n)"
            />
          </div>
        </div>
      </div>
    </div>

    <q-dialog v-model="open" :persistent="saving">
      <q-card
        class="ig-card ig-card--raised"
        style="width: 480px; max-width: 94vw; border-radius: 20px"
      >
        <q-form autocomplete="off" @submit.prevent="save">
          <q-card-section>
            <div class="text-h6">
              {{ editing ? t(`tenant.channels.names.${editing}`) : '' }}
            </div>
            <div class="ig-muted q-mt-xs">{{ t('tenant.channels.secretNote') }}</div>
          </q-card-section>
          <q-card-section class="q-gutter-y-md">
            <IgAlert v-if="formError" tone="error">{{ formError }}</IgAlert>
            <q-input
              v-model="account"
              outlined
              autocomplete="off"
              :label="t('tenant.channels.accountId')"
              :hint="editing ? t(`tenant.channels.accountHint.${editing}`) : ''"
            />
            <!-- The token is never shown again once saved, and the browser must not remember it. -->
            <q-input
              v-model="token"
              outlined
              :type="reveal ? 'text' : 'password'"
              autocomplete="new-password"
              :label="t('tenant.channels.token')"
              :hint="t('tenant.channels.tokenHint')"
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
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md q-gutter-x-sm">
            <IgButton
              variant="ghost"
              :disable="saving"
              :label="t('common.cancel')"
              @click="close"
            />
            <IgButton type="submit" variant="primary" :loading="saving" :label="t('common.save')" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>
