<script setup lang="ts">
import { useQuasar } from 'quasar';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DemoStatus, DemoThread } from '@/api/ops';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { useSessionStore } from '@/stores/session';
import { MAX_POLLS, newDemoSession, POLL_MS, SUGGESTIONS } from '@/utils/demo';
import { formatMicroUsd, formatMicroUsdPrecise } from '@/utils/stats';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const status = ref<DemoStatus | null>(null);
const loading = ref(true);
const failed = ref(false);
const settingUp = ref(false);

const sid = ref(newDemoSession());
const thread = ref<DemoThread>({
  messages: [],
  waiting: false,
  handoff_active: false,
  pending: [],
});
const draft = ref('');
const sending = ref(false);
const slow = ref(false);
const body = ref<HTMLElement | null>(null);

let alive = true;
onBeforeUnmount(() => {
  alive = false;
});

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    status.value = await session.ops.demo();
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function setup() {
  settingUp.value = true;
  try {
    status.value = await session.ops.demoSetup();
    $q.notify({ type: 'positive', message: t('admin.demo.setupDone') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    settingUp.value = false;
  }
}

async function scrollDown() {
  await nextTick();
  if (body.value) body.value.scrollTop = body.value.scrollHeight;
}

async function refresh() {
  thread.value = await session.ops.demoThread(sid.value);
  await scrollDown();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The answer comes from the worker, so look for it until it is there. */
async function waitForAnswer() {
  slow.value = false;
  for (let i = 0; i < MAX_POLLS && alive; i++) {
    await refresh();
    if (!thread.value.waiting) return;
    await sleep(POLL_MS);
  }
  slow.value = alive;
}

async function send(text: string) {
  const value = text.trim();
  if (!value || sending.value) return;
  sending.value = true;
  draft.value = '';
  try {
    // The message is shown at once; the thread of the server replaces it.
    thread.value = {
      ...thread.value,
      waiting: true,
      messages: [
        ...thread.value.messages,
        {
          id: `local-${Date.now()}`,
          from: 'in',
          body: value,
          state: 'pending',
          at: new Date().toISOString(),
        },
      ],
    };
    await scrollDown();
    await session.ops.demoSend(sid.value, value);
    await waitForAnswer();
    void loadStatus();
  } catch {
    $q.notify({ type: 'negative', message: t('admin.demo.failedSend') });
    await refresh().catch(() => undefined);
  } finally {
    sending.value = false;
  }
}

async function loadStatus() {
  try {
    status.value = await session.ops.demo();
  } catch {
    // The balance is a nicety: the conversation goes on without it.
  }
}

function newChat() {
  sid.value = newDemoSession();
  thread.value = { messages: [], waiting: false, handoff_active: false, pending: [] };
  slow.value = false;
}

async function answer(id: string, approve: boolean) {
  try {
    if (approve) await session.ops.demoApprove(id);
    else await session.ops.demoReject(id);
    $q.notify({
      type: approve ? 'positive' : 'info',
      message: approve ? t('admin.demo.approved') : t('admin.demo.rejected'),
    });
    await refresh();
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
    await refresh().catch(() => undefined);
  }
}

async function release() {
  try {
    await session.ops.demoRelease(sid.value);
    $q.notify({ type: 'positive', message: t('admin.demo.released') });
    await refresh();
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void send(draft.value);
  }
}
</script>

<template>
  <q-page padding>
    <div class="row items-end justify-between q-mb-lg q-col-gutter-md">
      <div class="col-12 col-sm">
        <div class="ig-eyebrow q-mb-xs">{{ t('admin.nav.demo') }}</div>
        <h1 class="text-h4 q-my-none">{{ t('admin.demo.title') }}</h1>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('admin.demo.intro') }}</p>
      </div>
      <div v-if="status?.ready" class="col-12 col-sm-auto">
        <IgButton
          variant="secondary"
          icon="restart_alt"
          :label="t('admin.demo.newChat')"
          @click="newChat"
        />
      </div>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>
    <q-skeleton v-if="loading && !status" height="160px" />

    <!-- Not set up yet -->
    <div
      v-else-if="status && !status.ready"
      class="ig-card q-pa-xl text-center"
      style="max-width: 640px; margin: 0 auto"
    >
      <div class="ig-empty__icon" style="margin: 0 auto 12px">
        <q-icon name="play_circle" size="28px" />
      </div>
      <h2 class="text-h6 q-mt-none">{{ t('admin.demo.setupTitle') }}</h2>
      <p class="ig-muted">{{ t('admin.demo.setupBody') }}</p>
      <IgButton
        variant="primary"
        :loading="settingUp"
        :label="t('admin.demo.setup')"
        @click="setup"
      />
    </div>

    <template v-else-if="status">
      <IgAlert tone="info" class="q-mb-md">{{ t('admin.demo.realNotice') }}</IgAlert>

      <div class="row q-col-gutter-lg">
        <!-- The prospect's phone -->
        <div class="col-12 col-lg-6">
          <div class="ig-phone" role="region" :aria-label="t('admin.demo.business')">
            <div class="ig-phone__bar">
              <span class="ig-avatar" style="background: rgb(255 255 255 / 22%)">LS</span>
              <div class="col">
                <div class="text-weight-bold">{{ t('admin.demo.business') }}</div>
                <div class="text-caption" style="opacity: 0.85">
                  {{ thread.waiting ? t('admin.demo.typing') : t('admin.demo.online') }}
                </div>
              </div>
            </div>

            <div ref="body" class="ig-phone__body" aria-live="polite">
              <div v-if="!thread.messages.length" class="q-mt-sm">
                <div class="ig-eyebrow q-mb-sm">{{ t('admin.demo.suggestions') }}</div>
                <div class="column q-gutter-y-sm items-start">
                  <button
                    v-for="s in SUGGESTIONS"
                    :key="s"
                    type="button"
                    class="ig-chip"
                    @click="send(s)"
                  >
                    {{ s }}
                  </button>
                </div>
              </div>

              <!-- The prospect writes on the right, as on their own phone; the assistant answers on the left. -->
              <div
                v-for="m in thread.messages"
                :key="m.id"
                class="row"
                :class="m.from === 'in' ? 'justify-end' : 'justify-start'"
              >
                <div
                  class="ig-bubble"
                  :class="m.from === 'in' ? 'ig-bubble--out' : 'ig-bubble--in'"
                  style="max-width: 86%"
                >
                  <!-- Text on purpose: what the model writes is never rendered as HTML. -->
                  <div>{{ m.body }}</div>
                  <div class="ig-bubble__meta" style="text-align: right; margin: 2px 0 0">
                    {{ when(m.at) }}
                  </div>
                </div>
              </div>
              <div v-if="thread.waiting" class="row justify-start">
                <div class="ig-typing" aria-hidden="true"><span /><span /><span /></div>
              </div>
              <IgAlert v-if="slow" tone="warn">{{ t('admin.demo.timeout') }}</IgAlert>
            </div>

            <div class="ig-phone__foot">
              <q-input
                v-model="draft"
                outlined
                dense
                autogrow
                maxlength="1000"
                :placeholder="t('admin.demo.placeholder')"
                :disable="sending"
                @keydown="onKey"
              >
                <template #append>
                  <IgButton
                    variant="primary"
                    icon-only
                    size="sm"
                    icon="send"
                    :label="t('admin.demo.send')"
                    :disable="!draft.trim() || sending"
                    @click="send(draft)"
                  />
                </template>
              </q-input>
            </div>
          </div>
        </div>

        <!-- What happens inside -->
        <div class="col-12 col-lg-6">
          <div class="ig-card q-pa-lg q-mb-md">
            <div class="ig-section-title">{{ t('admin.demo.inside') }}</div>
            <div class="text-caption ig-muted q-mb-md">{{ t('admin.demo.insideHint') }}</div>
            <div class="row items-center q-gutter-x-sm q-mb-sm">
              <span class="ig-eyebrow">{{ t('admin.demo.assistant') }}</span>
              <span class="ig-pill" :class="thread.waiting ? 'ig-pill--warn' : 'ig-pill--ok'">
                {{ thread.waiting ? t('admin.demo.answering') : t('admin.demo.idle') }}
              </span>
            </div>
            <IgAlert v-if="thread.handoff_active" tone="warn" class="q-mt-md">
              <div class="text-weight-bold">{{ t('admin.demo.handoff') }}</div>
              <div class="text-caption" style="opacity: 0.85">
                {{ t('admin.demo.handoffBody') }}
              </div>
              <template #action>
                <IgButton
                  variant="primary"
                  size="sm"
                  :label="t('admin.demo.release')"
                  @click="release"
                />
              </template>
            </IgAlert>
          </div>

          <div class="ig-card q-pa-lg q-mb-md">
            <div class="ig-section-title">{{ t('admin.demo.pending') }}</div>
            <div class="text-caption ig-muted q-mb-md">{{ t('admin.demo.pendingHint') }}</div>
            <div v-if="!thread.pending.length" class="ig-muted">
              {{ t('admin.demo.noPending') }}
            </div>
            <div v-for="a in thread.pending" :key="a.id" class="q-mb-md">
              <span
                class="ig-pill"
                :class="a.risk === 'external' ? 'ig-pill--warn' : 'ig-pill--brand'"
              >
                {{ t(`tenant.actions.risk.${a.risk}`) }}
              </span>
              <div
                class="text-weight-bold q-mt-xs"
                style="white-space: pre-wrap; word-break: break-word"
              >
                {{ a.summary }}
              </div>
              <div class="row q-gutter-x-sm q-mt-sm">
                <IgButton
                  variant="primary"
                  size="sm"
                  icon="check"
                  :label="t('admin.demo.approve')"
                  @click="answer(a.id, true)"
                />
                <IgButton
                  variant="secondary"
                  size="sm"
                  :label="t('admin.demo.reject')"
                  @click="answer(a.id, false)"
                />
              </div>
            </div>
          </div>

          <div class="ig-card q-pa-lg">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-4">
                <div class="ig-eyebrow q-mb-xs">{{ t('admin.demo.knowledge') }}</div>
                <div class="text-weight-bold">
                  {{ t('admin.demo.documents', { n: status.documents }) }}
                </div>
              </div>
              <div class="col-6 col-sm-4">
                <div class="ig-eyebrow q-mb-xs">{{ t('admin.demo.credit') }}</div>
                <div class="text-weight-bold ig-num">
                  {{ formatMicroUsdPrecise(status.balance_micro) }}
                </div>
              </div>
              <div class="col-6 col-sm-4">
                <div class="ig-eyebrow q-mb-xs">{{ t('admin.demo.cap') }}</div>
                <div class="text-weight-bold ig-num">
                  {{ formatMicroUsd(status.daily_cap_micro) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </q-page>
</template>
