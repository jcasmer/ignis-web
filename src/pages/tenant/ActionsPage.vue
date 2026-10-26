<script setup lang="ts">
import { useQuasar } from 'quasar';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ApiError } from '@/api/http';
import type { PendingAction } from '@/api/tenant';
import { useSessionStore } from '@/stores/session';

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
    <h1 class="text-h4 text-weight-bold q-mt-none q-mb-sm">{{ t('tenant.actions.title') }}</h1>
    <p class="ig-muted q-mb-lg">{{ t('tenant.actions.intro') }}</p>

    <q-banner v-if="failed" role="alert" class="ig-card q-mb-md">
      {{ t('common.loadError') }}
      <template #action><q-btn flat no-caps :label="t('common.retry')" @click="load" /></template>
    </q-banner>

    <q-skeleton v-if="loading && !items.length" height="120px" class="rounded-borders" />
    <div v-else-if="!items.length && !failed" class="ig-card q-pa-xl text-center ig-muted">
      <q-icon name="task_alt" size="36px" style="color: var(--ig-amber-500)" />
      <div class="q-mt-sm">{{ t('tenant.actions.empty') }}</div>
    </div>

    <div class="column q-gutter-y-md">
      <div v-for="a in items" :key="a.id" class="ig-card q-pa-md">
        <div class="row items-start no-wrap q-col-gutter-md">
          <div class="col">
            <div class="row items-center q-gutter-x-sm q-mb-xs">
              <q-badge
                color="accent"
                text-color="dark"
                :label="t(`tenant.actions.risk.${a.risk}`)"
              />
              <span class="text-caption ig-muted"
                >{{ t('tenant.actions.expires') }} {{ when(a.expires_at) }}</span
              >
            </div>
            <div
              class="text-subtitle1 text-weight-medium"
              style="white-space: pre-wrap; word-break: break-word"
            >
              {{ a.summary }}
            </div>
            <q-btn
              flat
              dense
              no-caps
              size="sm"
              class="q-mt-xs"
              :label="t('tenant.actions.details')"
              @click="open = open === a.id ? null : a.id"
            />
            <!-- Shown as text: the arguments come from the assistant and are never trusted as markup. -->
            <pre
              v-if="open === a.id"
              class="ig-code q-mt-sm q-pa-sm rounded-borders"
              style="background: var(--ig-surface-2); overflow-x: auto"
              >{{ JSON.stringify(a.arguments, null, 2) }}</pre>
            <div class="text-caption ig-muted q-mt-sm">
              {{ t('tenant.actions.code') }}: <span class="ig-code">{{ a.code }}</span>
            </div>
          </div>
          <div class="col-auto column q-gutter-y-sm">
            <q-btn
              class="ig-btn-primary"
              unelevated
              no-caps
              :loading="busy === a.id"
              :label="t('tenant.actions.approve')"
              @click="answer(a, true)"
            />
            <q-btn
              outline
              no-caps
              :disable="busy === a.id"
              :label="t('tenant.actions.reject')"
              @click="answer(a, false)"
            />
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>
