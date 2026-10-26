<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Email, MailSettings } from '@/api/tenant';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const session = useSessionStore();

const settings = ref<MailSettings | null>(null);
const outbox = ref<Email[]>([]);
const loading = ref(true);
const failed = ref(false);

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    const [s, o] = await Promise.all([session.data.mailSettings(), session.data.mailOutbox(50)]);
    settings.value = s;
    outbox.value = o.items;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.mail') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.mail.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.mail.intro') }}</p>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <div class="ig-card q-pa-lg q-mb-md">
      <q-skeleton v-if="loading && !settings" height="90px" />
      <template v-else-if="settings">
        <IgAlert v-if="!settings.recipients.length" tone="warn" class="q-mb-md">
          {{ t('tenant.mail.notConfigured') }}
        </IgAlert>
        <div class="row q-col-gutter-lg">
          <div class="col-12 col-sm-4">
            <div class="ig-eyebrow q-mb-xs">{{ t('tenant.mail.business') }}</div>
            <div class="text-subtitle1 text-weight-bold">{{ settings.business_name || '—' }}</div>
          </div>
          <div class="col-12 col-sm-5">
            <div class="ig-eyebrow q-mb-xs">{{ t('tenant.mail.recipients') }}</div>
            <div v-for="r in settings.recipients" :key="r" class="ellipsis">{{ r }}</div>
            <div v-if="!settings.recipients.length">—</div>
          </div>
          <div class="col-12 col-sm-3">
            <div class="ig-eyebrow q-mb-xs">{{ t('tenant.mail.sentToday') }}</div>
            <div class="text-h5 text-weight-bold ig-num">{{ settings.sent_today }}</div>
          </div>
        </div>
        <div class="text-caption ig-muted q-mt-md">{{ t('common.managedByIgnis') }}</div>
      </template>
    </div>

    <div class="ig-card" style="overflow: hidden">
      <div class="q-pa-md q-pb-sm">
        <div class="ig-section-title">{{ t('tenant.mail.outbox') }}</div>
        <div class="text-caption ig-muted">{{ t('tenant.mail.outboxHint') }}</div>
      </div>
      <EmptyState
        v-if="!outbox.length && !loading"
        icon="mail_outline"
        :title="t('tenant.mail.empty')"
      />
      <div v-for="e in outbox" :key="e.id" class="ig-row" style="cursor: default">
        <div class="col" style="min-width: 0">
          <div class="text-weight-medium ellipsis">{{ e.subject }}</div>
          <div class="text-caption ig-muted ellipsis">
            {{ t(`tenant.mail.kind.${e.kind}`) }} · {{ e.to }} · {{ when(e.created_at) }}
          </div>
          <div
            v-if="e.status === 'failed' && e.reason"
            class="text-caption"
            style="color: var(--ig-error)"
          >
            {{ e.reason }}
          </div>
        </div>
        <span
          class="ig-pill"
          :class="{ 'ig-pill--ok': e.status === 'sent', 'ig-pill--warn': e.status === 'pending' }"
          :style="
            e.status === 'failed' ? 'background: var(--ig-error-bg); color: var(--ig-error)' : ''
          "
        >
          {{ t(`tenant.mail.status.${e.status}`) }}
        </span>
      </div>
    </div>
  </q-page>
</template>
