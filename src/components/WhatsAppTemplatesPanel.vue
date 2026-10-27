<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ApiError } from '@/api/http';
import type {
  TemplateStatus,
  WhatsAppClient,
  WhatsAppTemplate,
  WhatsAppTemplateInput,
} from '@/api/whatsapp';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import WhatsAppSendDialog from '@/components/WhatsAppSendDialog.vue';
import WhatsAppTemplateForm from '@/components/WhatsAppTemplateForm.vue';
import { refreshOnFocus } from '@/composables/refreshOnFocus';
import { knownDetail, validAccountId, variablesOf } from '@/utils/whatsapp';

const props = defineProps<{
  client: WhatsAppClient;
  /** Seen by the Ignis team, not by the customer: the texts say how to fix it, not whom to ask. */
  operator?: boolean;
}>();
const { t } = useI18n();
const $q = useQuasar();

const items = ref<WhatsAppTemplate[]>([]);
const loading = ref(true);
const failed = ref(false);
const notIncluded = ref(false);

// --- what the API says, in words ---------------------------------------------------------------
function explain(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'module_not_included') {
      return props.operator ? t('whatsapp.errors.moduleOperator') : t('whatsapp.errors.module');
    }
    if (e.status === 409) return t('whatsapp.errors.exists');
    if (e.status === 404) return t('whatsapp.errors.gone');
    const known = knownDetail(e.detail);
    if (known) return t(`whatsapp.errors.${known}`);
    if (e.status === 400 && e.detail) return t('whatsapp.errors.refusedWith', { why: e.detail });
    if (e.status === 400) return t('whatsapp.errors.refused');
  }
  return t('whatsapp.errors.failed');
}

// --- the account ---------------------------------------------------------------------------------
const account = ref('');
const savedAccount = ref('');
const savingAccount = ref(false);
const accountProblem = computed(() => !validAccountId(account.value.trim()));
const accountChanged = computed(() => account.value.trim() !== savedAccount.value);

async function saveAccount() {
  if (accountProblem.value || savingAccount.value) return;
  savingAccount.value = true;
  try {
    const saved = await props.client.saveSettings(account.value.trim());
    savedAccount.value = account.value = saved.business_account_id;
    $q.notify({ type: 'positive', message: t('whatsapp.account.saved') });
  } catch (e) {
    $q.notify({ type: 'negative', message: explain(e) });
  } finally {
    savingAccount.value = false;
  }
}

// --- the list ----------------------------------------------------------------------------------------
async function load() {
  failed.value = false;
  notIncluded.value = false;
  try {
    const [settings, list] = await Promise.all([props.client.settings(), props.client.templates()]);
    savedAccount.value = settings.business_account_id;
    if (!accountChanged.value || account.value === '') account.value = settings.business_account_id;
    items.value = list.items;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'module_not_included') notIncluded.value = true;
    else failed.value = true;
  } finally {
    loading.value = false;
  }
}

const syncing = ref(false);
/** Asks Meta how the review stands. `quiet` is for the automatic ask when the page opens. */
async function sync(quiet = false) {
  if (syncing.value || !savedAccount.value || !items.value.length) return;
  syncing.value = true;
  try {
    const res = await props.client.sync();
    await load();
    if (!quiet) {
      $q.notify({
        type: 'positive',
        message: res.updated
          ? t('whatsapp.sync.changed', { n: res.updated })
          : t('whatsapp.sync.same'),
      });
    }
  } catch (e) {
    if (!quiet) $q.notify({ type: 'negative', message: explain(e) });
  } finally {
    syncing.value = false;
  }
}

onMounted(async () => {
  await load();
  // What is waiting for Meta is asked about when the page opens, so nobody has to remember to.
  if (items.value.some((x) => x.status === 'pending')) void sync(true);
});
refreshOnFocus(load, 10_000);

const pending = computed(() => items.value.filter((x) => x.status === 'pending').length);

// --- a new template -----------------------------------------------------------------------------------
const creating = ref(false);
const saving = ref(false);
const formError = ref('');

function start() {
  if (!savedAccount.value) {
    $q.notify({ type: 'warning', message: t('whatsapp.account.first') });
    return;
  }
  formError.value = '';
  creating.value = true;
}

async function create(input: WhatsAppTemplateInput) {
  saving.value = true;
  formError.value = '';
  try {
    await props.client.create(input);
    creating.value = false;
    $q.notify({ type: 'positive', message: t('whatsapp.created') });
    await load();
  } catch (e) {
    formError.value = explain(e);
  } finally {
    saving.value = false;
  }
}

// --- sending a test -------------------------------------------------------------------------------------
const sending = ref<WhatsAppTemplate | null>(null);
const sendOpen = computed({
  get: () => sending.value !== null,
  set: (v) => {
    if (!v) sending.value = null;
  },
});
const sendBusy = ref(false);
const sendError = ref('');

function startSend(tpl: WhatsAppTemplate) {
  sendError.value = '';
  sending.value = tpl;
}

async function send(to: string, params: string[]) {
  const tpl = sending.value;
  if (!tpl) return;
  sendBusy.value = true;
  sendError.value = '';
  try {
    await props.client.send(tpl.id, to, params);
    sending.value = null;
    $q.notify({ type: 'positive', message: t('whatsapp.send.sent') });
  } catch (e) {
    sendError.value = explain(e);
  } finally {
    sendBusy.value = false;
  }
}

// --- delete -------------------------------------------------------------------------------------------------
const removing = ref<WhatsAppTemplate | null>(null);
const confirmOpen = computed({
  get: () => removing.value !== null,
  set: (v) => {
    if (!v) removing.value = null;
  },
});
const deleting = ref(false);

async function remove() {
  const tpl = removing.value;
  if (!tpl) return;
  deleting.value = true;
  try {
    await props.client.remove(tpl.id);
    items.value = items.value.filter((x) => x.id !== tpl.id);
    removing.value = null;
    $q.notify({ type: 'positive', message: t('whatsapp.deleted') });
  } catch (e) {
    removing.value = null;
    $q.notify({ type: 'negative', message: explain(e) });
  } finally {
    deleting.value = false;
  }
}

// --- how a template reads ---------------------------------------------------------------------------
const pill = (s: TemplateStatus) =>
  s === 'approved' ? 'ig-pill--ok' : s === 'rejected' ? 'ig-pill--error' : 'ig-pill--warn';
const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
</script>

<template>
  <div>
    <IgAlert v-if="notIncluded" tone="info">
      {{ operator ? t('whatsapp.errors.moduleOperator') : t('whatsapp.errors.module') }}
    </IgAlert>
    <IgAlert v-else-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <template v-else>
      <!-- The account Meta keeps the templates in -->
      <section class="ig-card q-pa-lg q-mb-md">
        <div class="text-h6">{{ t('whatsapp.account.title') }}</div>
        <p class="ig-muted q-mt-xs">{{ t('whatsapp.account.intro') }}</p>
        <div class="row q-col-gutter-sm items-start">
          <div class="col-12 col-sm">
            <q-input
              v-model="account"
              outlined
              dense
              inputmode="numeric"
              :label="t('whatsapp.account.label')"
              :hint="t('whatsapp.account.hint')"
              :error="accountProblem"
              :error-message="t('whatsapp.account.problem')"
              @keyup.enter="saveAccount"
            />
          </div>
          <div class="col-12 col-sm-auto">
            <IgButton
              variant="secondary"
              :label="t('whatsapp.account.save')"
              :loading="savingAccount"
              :disable="accountProblem || !accountChanged"
              @click="saveAccount"
            />
          </div>
        </div>
        <IgAlert v-if="!savedAccount" tone="info" class="q-mt-md">
          {{ t('whatsapp.account.where') }}
        </IgAlert>
      </section>

      <div class="row items-center q-col-gutter-sm q-mb-md">
        <div class="col-12 col-sm">
          <div class="text-h6">{{ t('whatsapp.list.title') }}</div>
          <div class="text-caption ig-muted">
            {{ pending ? t('whatsapp.list.pending', { n: pending }) : t('whatsapp.list.intro') }}
          </div>
        </div>
        <div class="col-12 col-sm-auto row q-gutter-sm">
          <IgButton
            variant="secondary"
            icon="sync"
            :label="t('whatsapp.sync.button')"
            :loading="syncing"
            :disable="!savedAccount || !items.length"
            @click="sync(false)"
          />
          <IgButton variant="primary" icon="add" :label="t('whatsapp.new')" @click="start" />
        </div>
      </div>

      <q-skeleton v-if="loading && !items.length" height="140px" />
      <div v-else-if="!items.length" class="ig-card">
        <EmptyState
          icon="chat_bubble_outline"
          :title="t('whatsapp.empty.title')"
          :hint="t('whatsapp.empty.hint')"
        />
      </div>

      <div class="column q-gutter-y-md">
        <div v-for="x in items" :key="x.id" class="ig-card q-pa-lg">
          <div class="row items-center no-wrap q-mb-xs">
            <div class="col" style="min-width: 0">
              <div class="text-subtitle1 text-weight-bold ellipsis">{{ x.name }}</div>
              <div class="text-caption ig-muted">
                {{ x.language }} · {{ t(`whatsapp.category.${x.category}`) }} ·
                {{ t('whatsapp.list.updated', { at: when(x.updated_at) }) }}
              </div>
            </div>
            <span class="ig-pill q-ml-sm" :class="pill(x.status)">
              {{ t(`whatsapp.status.${x.status}`) }}
            </span>
          </div>
          <!-- Text on purpose: it was written by a person, never rendered as HTML. -->
          <div class="ig-tpl-body q-my-sm">{{ x.body }}</div>
          <div v-if="x.footer" class="text-caption ig-muted q-mb-sm">{{ x.footer }}</div>
          <IgAlert v-if="x.status === 'rejected'" tone="error" class="q-mb-sm">
            {{ t('whatsapp.rejected', { why: x.reason || t('whatsapp.noReason') }) }}
          </IgAlert>
          <div class="text-caption ig-muted q-mb-sm">
            {{ t(`whatsapp.statusHint.${x.status}`) }}
            <template v-if="variablesOf(x.body).length">
              · {{ t('whatsapp.list.variables', { n: variablesOf(x.body).length }) }}
            </template>
          </div>
          <div class="row q-gutter-x-sm">
            <IgButton
              variant="secondary"
              size="sm"
              icon="send"
              :label="t('whatsapp.send.open')"
              :disable="x.status !== 'approved'"
              @click="startSend(x)"
            />
            <IgButton
              variant="ghost"
              size="sm"
              icon="delete_outline"
              :label="t('whatsapp.delete')"
              @click="removing = x"
            />
          </div>
        </div>
      </div>
    </template>

    <WhatsAppTemplateForm v-model="creating" :saving="saving" :error="formError" @save="create" />
    <WhatsAppSendDialog
      v-model="sendOpen"
      :template="sending"
      :sending="sendBusy"
      :error="sendError"
      @send="send"
    />
    <ConfirmDialog
      v-model="confirmOpen"
      destructive
      :loading="deleting"
      :title="t('whatsapp.deleteTitle', { name: removing?.name ?? '' })"
      :message="t('whatsapp.deleteBody')"
      :confirm-label="t('whatsapp.delete')"
      :cancel-label="t('common.cancel')"
      @confirm="remove"
    />
  </div>
</template>

<style scoped>
.ig-tpl-body {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ig-surface-2, rgba(127, 127, 127, 0.1));
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
