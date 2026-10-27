<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/api/http';
import type { QueueJob, QueueStats, TenantListItem } from '@/api/ops';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const i18n = useI18n();
const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const STATES = ['dead', 'ready', 'running', 'done'] as const;
type State = (typeof STATES)[number];

const state = ref<State>(
  (STATES as readonly string[]).includes(String(route.query.state))
    ? (String(route.query.state) as State)
    : 'dead',
);
const jobs = ref<QueueJob[]>([]);
const cursor = ref<string | undefined>();
const stats = ref<QueueStats | null>(null);
const tenants = ref<TenantListItem[]>([]);
const loading = ref(true);
const failed = ref(false);
const open = ref<string | null>(null);

async function load(more = false) {
  loading.value = true;
  failed.value = false;
  try {
    const [page, s] = await Promise.all([
      session.ops.queueJobs({
        state: state.value,
        limit: 50,
        ...(more && cursor.value && { cursor: cursor.value }),
      }),
      session.ops.queue(),
    ]);
    jobs.value = more ? [...jobs.value, ...page.items] : page.items;
    cursor.value = page.next_cursor;
    stats.value = s;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  void load();
  try {
    tenants.value = (await session.ops.tenants({ limit: 200 })).items;
  } catch {
    // The list still works: only the name of the client is missing.
  }
});

function pick(s: State) {
  state.value = s;
  open.value = null;
  void router.replace({ query: s === 'dead' ? {} : { state: s } });
  void load();
}

const options = computed(() =>
  STATES.map((s) => ({
    value: s,
    label: `${t(`admin.queue.states.${s}`)} · ${stats.value?.counts[s] ?? 0}`,
  })),
);

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

function typeName(type: string): string {
  const key = `admin.queue.jobs.${type}`;
  return i18n.te(key) ? t(key) : type;
}
const tenantName = (id?: string) => tenants.value.find((x) => x.id === id)?.name ?? '';

// --- retry and discard -------------------------------------------------------------
type Action = 'retry' | 'discard';
const asking = ref<{ job: QueueJob; action: Action } | null>(null);
const busy = ref(false);
const confirmOpen = computed({
  get: () => asking.value !== null,
  set: (v) => {
    if (!v) asking.value = null;
  },
});

async function confirm() {
  const a = asking.value;
  if (!a) return;
  busy.value = true;
  try {
    if (a.action === 'retry') await session.ops.retryJob(a.job.id);
    else await session.ops.discardJob(a.job.id);
    $q.notify({
      type: 'positive',
      message: t(a.action === 'retry' ? 'admin.queue.retried' : 'admin.queue.discarded'),
    });
    asking.value = null;
    await load();
  } catch (e) {
    $q.notify({
      type: 'warning',
      message:
        e instanceof ApiError && e.status === 409
          ? t('admin.queue.changed')
          : t('common.loadError'),
    });
    asking.value = null;
    await load();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('admin.nav.queue') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('admin.queue.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('admin.queue.intro') }}</p>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load()" />
      </template>
    </IgAlert>

    <div class="q-mb-sm" style="overflow-x: auto">
      <IgSegmented
        :model-value="state"
        :options="options"
        :label="t('admin.queue.title')"
        @update:model-value="pick($event as State)"
      />
    </div>
    <p class="text-caption ig-muted q-mb-md">{{ t(`admin.queue.stateHint.${state}`) }}</p>

    <div class="ig-card" style="overflow: hidden">
      <q-skeleton v-if="loading && !jobs.length" height="64px" class="q-ma-md" />
      <EmptyState
        v-else-if="!jobs.length"
        :icon="state === 'dead' ? 'check_circle' : 'inbox'"
        :title="state === 'dead' ? t('admin.queue.emptyDead') : t('admin.queue.empty')"
      />
      <div v-for="j in jobs" :key="j.id" class="ig-job">
        <div class="row items-start no-wrap q-gutter-x-md">
          <div class="col" style="min-width: 0">
            <div class="text-weight-medium">{{ typeName(j.type) }}</div>
            <div class="text-caption ig-muted">
              <template v-if="tenantName(j.tenant_id)">{{ tenantName(j.tenant_id) }} · </template>
              {{ t('admin.queue.attempts', { n: j.attempts, max: j.max_attempts }) }} ·
              {{ when(j.created_at) }}
            </div>
            <button
              v-if="j.state === 'dead'"
              type="button"
              class="ig-job__why text-caption"
              :aria-expanded="open === j.id"
              @click="open = open === j.id ? null : j.id"
            >
              <q-icon :name="open === j.id ? 'expand_less' : 'expand_more'" size="16px" />
              {{ t('admin.queue.reason') }}
            </button>
            <pre v-if="open === j.id" class="ig-job__error ig-code">{{
              j.last_error || t('admin.queue.noReason')
            }}</pre>
          </div>
          <div v-if="j.state === 'dead'" class="row q-gutter-xs no-wrap">
            <IgButton
              variant="secondary"
              size="sm"
              icon="replay"
              :label="t('admin.queue.retry')"
              @click="asking = { job: j, action: 'retry' }"
            />
            <IgButton
              variant="ghost"
              size="sm"
              icon="delete_outline"
              :label="t('admin.queue.discard')"
              @click="asking = { job: j, action: 'discard' }"
            />
          </div>
        </div>
      </div>
      <div v-if="cursor" class="q-pa-sm text-center">
        <IgButton
          variant="ghost"
          size="sm"
          :loading="loading"
          :label="t('admin.queue.more')"
          @click="load(true)"
        />
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmOpen"
      :loading="busy"
      :destructive="asking?.action === 'discard'"
      :title="
        asking?.action === 'retry' ? t('admin.queue.retryTitle') : t('admin.queue.discardTitle')
      "
      :message="
        asking?.action === 'retry' ? t('admin.queue.retryBody') : t('admin.queue.discardBody')
      "
      :confirm-label="
        asking?.action === 'retry' ? t('admin.queue.retry') : t('admin.queue.discard')
      "
      :cancel-label="t('common.cancel')"
      @confirm="confirm"
    />
  </q-page>
</template>

<style scoped lang="scss">
.ig-job {
  padding: 14px 16px;
  border-bottom: 1px solid var(--ig-line);
  &:last-of-type {
    border-bottom: 0;
  }
}
.ig-job__why {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ig-link);
  cursor: pointer;
}
.ig-job__error {
  margin: 8px 0 0;
  padding: 10px 12px;
  background: var(--ig-surface-2);
  border: 1px solid var(--ig-line);
  border-radius: var(--ig-r-sm);
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
