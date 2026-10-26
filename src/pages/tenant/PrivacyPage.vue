<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Consent, ConsentPurpose, Contact, Erasure } from '@/api/tenant';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const tab = ref<'notice' | 'contacts' | 'erasures'>('notice');

const notice = ref<{ notice: string; version: number } | null>(null);
const contacts = ref<Contact[]>([]);
const erasures = ref<Erasure[]>([]);
const loading = ref(true);
const failed = ref(false);

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
const nameOf = (c: Contact) => c.display_name || c.external_id || t('tenant.privacy.noName');

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    const [n, c, e] = await Promise.all([
      session.data.privacyNotice(),
      session.data.contacts(100),
      session.data.erasures(100),
    ]);
    notice.value = n;
    contacts.value = c.items;
    erasures.value = e.items;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const tone = (s: Consent['status']) =>
  s === 'granted' ? 'ig-pill--ok' : s === 'revoked' ? 'ig-pill--warn' : '';

// --- consents of one contact ---------------------------------------------
const viewing = ref<Contact | null>(null);
const viewOpen = computed({
  get: () => viewing.value !== null,
  set: (v) => {
    if (!v) viewing.value = null;
  },
});

// --- recording a consent --------------------------------------------------
const recording = ref<Contact | null>(null);
const recordOpen = computed({
  get: () => recording.value !== null,
  set: (v) => {
    if (!v) recording.value = null;
  },
});
const purpose = ref<ConsentPurpose>('data_processing');
const granted = ref<'yes' | 'no'>('yes');
const address = ref('');
const evidence = ref('');
const recordError = ref('');
const saving = ref(false);

function startRecord(c: Contact) {
  recording.value = c;
  purpose.value = 'data_processing';
  granted.value = 'yes';
  address.value = '';
  evidence.value = '';
  recordError.value = '';
}

async function saveConsent() {
  const c = recording.value;
  if (!c) return;
  recordError.value = '';
  const yes = granted.value === 'yes';
  if (yes && !evidence.value.trim()) return void (recordError.value = t('auth.errors.required'));
  if (purpose.value === 'email' && !/^\S+@\S+\.\S+$/.test(address.value.trim()))
    return void (recordError.value = t('auth.errors.email'));
  saving.value = true;
  try {
    await session.data.recordConsent(c.id, {
      purpose: purpose.value,
      granted: yes,
      ...(purpose.value === 'email' && { address: address.value.trim() }),
      ...(evidence.value.trim() && { evidence: evidence.value.trim() }),
    });
    recording.value = null;
    $q.notify({ type: 'positive', message: t('tenant.privacy.recorded') });
    await load();
  } catch {
    recordError.value = t('common.loadError');
  } finally {
    saving.value = false;
  }
}

// --- export and erase -----------------------------------------------------
async function exportContact(c: Contact) {
  try {
    const data = await session.data.exportContact(c.id);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `ignis-contacto-${c.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    $q.notify({ type: 'positive', message: t('tenant.privacy.exported') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  }
}

const toErase = ref<Contact | null>(null);
const eraseOpen = computed({
  get: () => toErase.value !== null,
  set: (v) => {
    if (!v) toErase.value = null;
  },
});
const erasing = ref(false);

async function erase() {
  const c = toErase.value;
  if (!c) return;
  erasing.value = true;
  try {
    await session.data.eraseContact(c.id);
    toErase.value = null;
    $q.notify({ type: 'positive', message: t('tenant.privacy.erased') });
    await load();
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    erasing.value = false;
  }
}
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.privacy') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.privacy.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.privacy.intro') }}</p>
    </div>

    <div class="ig-scroll-x q-mb-md">
      <IgSegmented
        v-model="tab"
        :label="t('tenant.privacy.title')"
        :options="[
          { value: 'notice', label: t('tenant.privacy.tabs.notice') },
          { value: 'contacts', label: t('tenant.privacy.tabs.contacts') },
          { value: 'erasures', label: t('tenant.privacy.tabs.erasures') },
        ]"
      />
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <!-- Notice -->
    <div v-if="tab === 'notice'" class="ig-card q-pa-lg">
      <q-skeleton v-if="loading && !notice" height="120px" />
      <template v-else-if="notice">
        <span class="ig-pill ig-pill--brand q-mb-md">{{
          t('tenant.privacy.version', { n: notice.version })
        }}</span>
        <!-- The notice is text from the tenant's settings: shown as text, never as HTML. -->
        <p style="white-space: pre-wrap; line-height: 1.6" class="q-mb-md">{{ notice.notice }}</p>
        <div class="text-caption ig-muted">{{ t('tenant.privacy.noticeNote') }}</div>
        <div class="text-caption ig-muted q-mt-xs">{{ t('common.managedByIgnis') }}</div>
      </template>
    </div>

    <!-- Contacts -->
    <div v-else-if="tab === 'contacts'" class="ig-card" style="overflow: hidden">
      <q-skeleton v-if="loading && !contacts.length" height="88px" class="q-ma-md" />
      <EmptyState
        v-else-if="!contacts.length"
        icon="groups"
        :title="t('tenant.privacy.noContacts')"
      />
      <div
        v-for="c in contacts"
        :key="c.id"
        class="ig-row"
        style="cursor: default; align-items: flex-start"
      >
        <span class="ig-avatar">{{ nameOf(c).charAt(0).toUpperCase() }}</span>
        <div class="col" style="min-width: 0">
          <div class="text-weight-bold ellipsis">{{ nameOf(c) }}</div>
          <div class="text-caption ig-muted ellipsis">
            {{ c.channel }} · {{ c.external_id }} · {{ when(c.created_at) }}
          </div>
          <div class="row q-gutter-xs q-mt-xs">
            <span v-for="k in c.consents" :key="k.purpose" class="ig-pill" :class="tone(k.status)">
              {{ t(`tenant.privacy.purpose.${k.purpose}`) }}:
              {{ t(`tenant.privacy.status.${k.status}`) }}
            </span>
            <span v-if="!c.consents.length" class="ig-pill">{{
              t('tenant.privacy.noConsentsShort')
            }}</span>
          </div>
        </div>
        <IgButton variant="ghost" icon-only icon="more_vert" :label="t('common.menu')">
          <q-menu anchor="bottom right" self="top right" class="ig-menu">
            <q-list padding style="min-width: 220px">
              <q-item v-close-popup clickable @click="viewing = c">
                <q-item-section avatar style="min-width: 36px"
                  ><q-icon name="fact_check"
                /></q-item-section>
                <q-item-section>{{ t('tenant.privacy.consents') }}</q-item-section>
              </q-item>
              <q-item v-close-popup clickable @click="startRecord(c)">
                <q-item-section avatar style="min-width: 36px"
                  ><q-icon name="edit_note"
                /></q-item-section>
                <q-item-section>{{ t('tenant.privacy.record') }}</q-item-section>
              </q-item>
              <q-item v-close-popup clickable @click="exportContact(c)">
                <q-item-section avatar style="min-width: 36px"
                  ><q-icon name="download"
                /></q-item-section>
                <q-item-section>{{ t('tenant.privacy.export') }}</q-item-section>
              </q-item>
              <q-separator class="q-my-xs" />
              <q-item v-close-popup clickable style="color: var(--ig-error)" @click="toErase = c">
                <q-item-section avatar style="min-width: 36px"
                  ><q-icon name="delete_outline"
                /></q-item-section>
                <q-item-section>{{ t('tenant.privacy.erase') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </IgButton>
      </div>
    </div>

    <!-- Erasures -->
    <div v-else class="ig-card" style="overflow: hidden">
      <div class="q-pa-md q-pb-sm text-body2 ig-muted">{{ t('tenant.privacy.erasuresIntro') }}</div>
      <EmptyState
        v-if="!erasures.length && !loading"
        icon="history"
        :title="t('tenant.privacy.noErasures')"
      />
      <div v-for="e in erasures" :key="e.id" class="ig-row" style="cursor: default">
        <div class="col" style="min-width: 0">
          <div class="text-weight-medium ig-code ellipsis">{{ e.contact_code.slice(0, 16) }}…</div>
          <div class="text-caption ig-muted">
            {{ e.channel }} · {{ when(e.erased_at) }} · {{ e.proofs.length }}
            {{ t('tenant.privacy.proofs') }}
          </div>
        </div>
        <span class="ig-pill">{{ t(`tenant.privacy.reason.${e.reason}`) }}</span>
      </div>
    </div>

    <!-- Consents of a contact -->
    <q-dialog v-model="viewOpen">
      <q-card
        class="ig-card ig-card--raised"
        style="width: 520px; max-width: 94vw; border-radius: 20px"
      >
        <q-card-section>
          <div class="text-h6">{{ viewing ? nameOf(viewing) : '' }}</div>
          <div class="ig-muted">{{ t('tenant.privacy.consents') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none" style="max-height: 60vh; overflow-y: auto">
          <div v-if="!viewing?.consents.length" class="ig-muted">
            {{ t('tenant.privacy.noConsents') }}
          </div>
          <div v-for="k in viewing?.consents" :key="k.purpose" class="q-mb-md">
            <div class="row items-center q-gutter-x-sm">
              <span class="text-weight-bold">{{ t(`tenant.privacy.purpose.${k.purpose}`) }}</span>
              <span class="ig-pill" :class="tone(k.status)">{{
                t(`tenant.privacy.status.${k.status}`)
              }}</span>
            </div>
            <div class="text-caption ig-muted">
              <template v-if="k.source">{{ t(`tenant.privacy.source.${k.source}`) }} · </template>
              {{ t('tenant.privacy.version', { n: k.notice_version }) }} · {{ when(k.updated_at) }}
              <template v-if="k.address"> · {{ k.address }}</template>
            </div>
            <div v-if="k.evidence" class="q-mt-xs">
              <div class="ig-eyebrow">{{ t('tenant.privacy.evidence') }}</div>
              <div
                style="white-space: pre-wrap; background: var(--ig-surface-2); border-radius: 10px"
                class="q-pa-sm text-body2"
              >
                {{ k.evidence }}
              </div>
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right" class="q-pa-md">
          <IgButton variant="primary" :label="t('common.close')" @click="viewOpen = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Record a consent -->
    <q-dialog v-model="recordOpen" :persistent="saving">
      <q-card
        class="ig-card ig-card--raised"
        style="width: 520px; max-width: 94vw; border-radius: 20px"
      >
        <q-form @submit.prevent="saveConsent">
          <q-card-section>
            <div class="text-h6">{{ t('tenant.privacy.record') }}</div>
            <div class="ig-muted q-mt-xs">{{ recording ? nameOf(recording) : '' }}</div>
            <p class="text-body2 ig-muted q-mt-sm q-mb-none">
              {{ t('tenant.privacy.recordHint') }}
            </p>
          </q-card-section>
          <q-card-section class="q-gutter-y-md">
            <IgAlert v-if="recordError" tone="error">{{ recordError }}</IgAlert>
            <IgSegmented
              v-model="purpose"
              block
              :label="t('tenant.privacy.consents')"
              :options="[
                { value: 'data_processing', label: t('tenant.privacy.purpose.data_processing') },
                { value: 'email', label: t('tenant.privacy.purpose.email') },
              ]"
            />
            <IgSegmented
              v-model="granted"
              block
              :label="t('tenant.privacy.consents')"
              :options="[
                { value: 'yes', label: t('tenant.privacy.granted') },
                { value: 'no', label: t('tenant.privacy.revoked') },
              ]"
            />
            <q-input
              v-if="purpose === 'email'"
              v-model="address"
              outlined
              type="email"
              :label="t('tenant.privacy.address')"
            />
            <q-input
              v-model="evidence"
              outlined
              type="textarea"
              autogrow
              maxlength="1500"
              counter
              :label="t('tenant.privacy.evidenceLabel')"
            />
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md q-gutter-x-sm">
            <IgButton
              variant="ghost"
              :disable="saving"
              :label="t('common.cancel')"
              @click="recordOpen = false"
            />
            <IgButton type="submit" variant="primary" :loading="saving" :label="t('common.save')" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <ConfirmDialog
      v-model="eraseOpen"
      destructive
      :loading="erasing"
      :title="t('tenant.privacy.eraseTitle')"
      :message="toErase ? `${nameOf(toErase)}\n${t('tenant.privacy.eraseBody')}` : ''"
      :confirm-label="t('tenant.privacy.erase')"
      :cancel-label="t('common.cancel')"
      :type-to-confirm="t('tenant.privacy.eraseType')"
      :type-hint="t('tenant.privacy.eraseTypeHint')"
      @confirm="erase"
    />
  </q-page>
</template>
