<script setup lang="ts">
import { useQuasar } from 'quasar';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ApiError } from '@/api/http';
import type { PendingAction } from '@/api/tenant';
import { useSessionStore } from '@/stores/session';
import IgButton from '@/components/IgButton.vue';
import IgAlert from '@/components/IgAlert.vue';
import EmptyState from '@/components/EmptyState.vue';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const items = ref<PendingAction[]>([]);
const loading = ref(false);
const failed = ref(false);
const busy = ref<string | null>(null);
const open = ref<string | null>(null);

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    items.value = (await session.data.actions('pending')).items;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function drop(id: string) {
  items.value = items.value.filter((a) => a.id !== id);
}

async function answer(a: PendingAction, approve: boolean) {
  busy.value = a.id;
  try {
    if (approve) {
      const done = await session.data.approve(a.id);
      $q.notify({
        type: done.status === 'failed' ? 'warning' : 'positive',
        message:
          done.status === 'failed' ? t('tenant.actions.failed') : t('tenant.actions.approved'),
      });
    } else {
      await session.data.reject(a.id);
      $q.notify({ type: 'info', message: t('tenant.actions.rejected') });
    }
    drop(a.id);
  } catch (e) {
    // 409: someone else answered first. It is no longer ours to decide.
    if (e instanceof ApiError && (e.status === 409 || e.status === 404)) {
      $q.notify({ type: 'warning', message: t('tenant.actions.alreadyAnswered') });
      drop(a.id);
    } else {
      $q.notify({ type: 'negative', message: t('common.loadError') });
    }
  } finally {
    busy.value = null;
  }
}

onMounted(load);
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.actions') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.actions.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.actions.intro') }}</p>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <q-skeleton v-if="loading && !items.length" height="130px" />
    <div v-else-if="!items.length && !failed" class="ig-card">
      <EmptyState icon="task_alt" :title="t('tenant.actions.empty')" />
    </div>

    <div class="column no-wrap q-gutter-y-md">
      <div v-for="a in items" :key="a.id" class="ig-card q-pa-md">
        <div class="row items-start q-col-gutter-md">
          <div class="col-12 col-sm">
            <div class="row items-center q-gutter-x-sm q-mb-sm">
              <span
                class="ig-pill"
                :class="a.risk === 'external' ? 'ig-pill--warn' : 'ig-pill--brand'"
              >
                <q-icon :name="a.risk === 'external' ? 'north_east' : 'edit'" size="13px" />
                {{ t(`tenant.actions.risk.${a.risk}`) }}
              </span>
              <span class="text-caption ig-muted"
                >{{ t('tenant.actions.expires') }} {{ when(a.expires_at) }}</span
              >
            </div>
            <div
              class="text-subtitle1 text-weight-bold"
              style="white-space: pre-wrap; word-break: break-word"
            >
              {{ a.summary }}
            </div>
            <IgButton
              class="q-mt-xs"
              variant="ghost"
              size="sm"
              :label="t('tenant.actions.details')"
              @click="open = open === a.id ? null : a.id"
            />
            <!-- Shown as text: the arguments come from the assistant and are never trusted as markup. -->
            <pre
              v-if="open === a.id"
              class="ig-code q-mt-sm q-pa-sm"
              style="background: var(--ig-surface-2); border-radius: 10px; overflow-x: auto"
              >{{ JSON.stringify(a.arguments, null, 2) }}</pre>
            <div class="text-caption ig-muted q-mt-sm">
              {{ t('tenant.actions.code') }}: <span class="ig-code">{{ a.code }}</span>
            </div>
          </div>
          <div class="col-12 col-sm-auto">
            <div class="row q-col-gutter-sm no-wrap column-sm">
              <div class="col-6 col-sm-12">
                <IgButton
                  variant="primary"
                  block
                  icon="check"
                  :loading="busy === a.id"
                  :label="t('tenant.actions.approve')"
                  @click="answer(a, true)"
                />
              </div>
              <div class="col-6 col-sm-12">
                <IgButton
                  variant="secondary"
                  block
                  :disable="busy === a.id"
                  :label="t('tenant.actions.reject')"
                  @click="answer(a, false)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>
