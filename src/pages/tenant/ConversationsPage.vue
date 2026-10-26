<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ConversationMessage, ConversationSummary, Handoff } from '@/api/tenant';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const list = ref<ConversationSummary[]>([]);
const listCursor = ref<string | undefined>();
const handoffs = ref<Record<string, Handoff>>({});
const loadingList = ref(false);
const failed = ref(false);

const selected = ref<ConversationSummary | null>(null);
const messages = ref<ConversationMessage[]>([]);
const olderCursor = ref<string | undefined>();
const loadingThread = ref(false);
const closing = ref(false);
const thread = ref<HTMLElement | null>(null);

const handoff = computed(() => (selected.value ? handoffs.value[selected.value.id] : undefined));

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

const nameOf = (c: ConversationSummary) =>
  c.contact.display_name || c.contact.external_id || t('tenant.conversations.noName');

async function loadList(more = false) {
  loadingList.value = true;
  failed.value = false;
  try {
    const page = await session.data.conversations(
      more && listCursor.value ? { cursor: listCursor.value } : {},
    );
    list.value = more ? [...list.value, ...page.items] : page.items;
    listCursor.value = page.next_cursor;
  } catch {
    failed.value = true;
  } finally {
    loadingList.value = false;
  }
}

async function loadHandoffs() {
  try {
    const { items } = await session.data.handoffs('active');
    handoffs.value = Object.fromEntries(items.map((h) => [h.conversation_id, h]));
  } catch {
    // The list still works; only the "a person has it" marks are missing.
  }
}

async function open(c: ConversationSummary) {
  selected.value = c;
  messages.value = [];
  olderCursor.value = undefined;
  loadingThread.value = true;
  try {
    const page = await session.data.messages(c.id);
    messages.value = page.items;
    olderCursor.value = page.next_cursor;
    // The newest message is what one came to read.
    await nextTick();
    if (thread.value) thread.value.scrollTop = thread.value.scrollHeight;
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    loadingThread.value = false;
  }
}

async function loadOlder() {
  if (!selected.value || !olderCursor.value) return;
  loadingThread.value = true;
  try {
    const page = await session.data.messages(selected.value.id, { cursor: olderCursor.value });
    messages.value = [...page.items, ...messages.value];
    olderCursor.value = page.next_cursor;
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    loadingThread.value = false;
  }
}

async function giveBack() {
  const h = handoff.value;
  if (!h) return;
  closing.value = true;
  try {
    await session.data.closeHandoff(h.id);
    const next = { ...handoffs.value };
    delete next[h.conversation_id];
    handoffs.value = next;
    if (selected.value) selected.value = { ...selected.value, handoff_active: false };
    list.value = list.value.map((c) =>
      c.id === h.conversation_id ? { ...c, handoff_active: false } : c,
    );
    $q.notify({ type: 'positive', message: t('tenant.conversations.returned') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    closing.value = false;
  }
}

onMounted(() => {
  void loadList();
  void loadHandoffs();
});
</script>

<template>
  <q-page padding>
    <h1 class="text-h4 text-weight-bold q-mt-none q-mb-md">
      {{ t('tenant.conversations.title') }}
    </h1>

    <div class="row q-col-gutter-md">
      <!-- On a phone only one of the two panes shows at a time. -->
      <div class="col-12 col-md-4" :class="{ 'gt-sm': selected }">
        <div class="ig-card">
          <q-banner v-if="failed" role="alert" class="bg-transparent">
            {{ t('common.loadError') }}
            <template #action
              ><q-btn flat no-caps :label="t('common.retry')" @click="loadList()"
            /></template>
          </q-banner>
          <q-list separator>
            <q-item
              v-for="c in list"
              :key="c.id"
              clickable
              :active="selected?.id === c.id"
              active-class="ig-selected"
              @click="open(c)"
            >
              <q-item-section avatar>
                <q-avatar color="accent" text-color="dark" size="40px">{{
                  nameOf(c).charAt(0).toUpperCase()
                }}</q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium ellipsis">{{ nameOf(c) }}</q-item-label>
                <q-item-label caption lines="1">
                  <q-icon
                    :name="c.last_direction === 'in' ? 'south_west' : 'north_east'"
                    size="12px"
                    class="q-mr-xs"
                  />{{ c.last_message }}
                </q-item-label>
              </q-item-section>
              <q-item-section side top>
                <q-item-label caption>{{
                  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(
                    new Date(c.last_message_at),
                  )
                }}</q-item-label>
                <q-icon v-if="c.handoff_active" name="support_agent" color="accent" size="18px"
                  ><q-tooltip>{{ t('tenant.conversations.handoffActive') }}</q-tooltip></q-icon
                >
              </q-item-section>
            </q-item>
          </q-list>
          <div v-if="loadingList && !list.length" class="q-pa-md">
            <q-skeleton v-for="n in 5" :key="n" height="48px" class="q-mb-sm" />
          </div>
          <div v-else-if="!list.length && !failed" class="q-pa-lg text-center ig-muted">
            {{ t('common.empty') }}
          </div>
          <div v-if="listCursor" class="q-pa-sm text-center">
            <q-btn
              flat
              no-caps
              :loading="loadingList"
              :label="t('common.loadMore')"
              @click="loadList(true)"
            />
          </div>
        </div>
      </div>

      <div class="col-12 col-md-8" :class="{ 'gt-sm': !selected }">
        <div class="ig-card" style="min-height: 420px">
          <div v-if="!selected" class="q-pa-xl text-center ig-muted">
            {{ t('tenant.conversations.select') }}
          </div>
          <template v-else>
            <div
              class="row items-center no-wrap q-pa-md"
              style="border-bottom: 1px solid var(--ig-line)"
            >
              <q-btn
                flat
                round
                dense
                icon="arrow_back"
                class="lt-md q-mr-sm"
                :aria-label="t('common.back')"
                @click="selected = null"
              />
              <div class="col">
                <div class="text-subtitle1 text-weight-medium">{{ nameOf(selected) }}</div>
                <div class="text-caption ig-muted">
                  {{ selected.contact.channel }} · {{ selected.contact.external_id }}
                </div>
              </div>
              <q-badge
                v-if="selected.status === 'closed'"
                outline
                color="grey"
                :label="t('tenant.conversations.closed')"
              />
            </div>

            <q-banner
              v-if="handoff"
              class="bg-transparent"
              style="border-bottom: 1px solid var(--ig-line)"
            >
              <template #avatar><q-icon name="support_agent" color="accent" /></template>
              {{ t('tenant.conversations.handoffActive') }}.
              <span class="ig-muted"
                >{{ t('tenant.conversations.expiresAt') }}: {{ when(handoff.expires_at) }}</span
              >
              <template #action>
                <q-btn
                  class="ig-btn-primary"
                  unelevated
                  no-caps
                  :loading="closing"
                  :label="t('tenant.conversations.returnToAssistant')"
                  @click="giveBack"
                />
              </template>
            </q-banner>

            <div
              ref="thread"
              class="q-pa-md column no-wrap q-gutter-y-sm"
              style="max-height: 62vh; overflow-y: auto"
            >
              <div v-if="olderCursor" class="text-center">
                <q-btn
                  flat
                  no-caps
                  size="sm"
                  :loading="loadingThread"
                  :label="t('tenant.conversations.older')"
                  @click="loadOlder"
                />
              </div>
              <q-skeleton v-if="loadingThread && !messages.length" height="60px" />
              <div
                v-for="m in messages"
                :key="m.id"
                class="row"
                :class="m.direction === 'out' ? 'justify-end' : 'justify-start'"
              >
                <div
                  class="q-pa-sm rounded-borders"
                  :style="{
                    maxWidth: '78%',
                    background:
                      m.direction === 'out' ? 'var(--ig-amber-300)' : 'var(--ig-surface-2)',
                    color: m.direction === 'out' ? 'var(--ig-ink)' : 'var(--ig-text)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }"
                >
                  <div class="text-caption" style="opacity: 0.7">
                    {{
                      m.direction === 'out'
                        ? t('tenant.conversations.outbound')
                        : t('tenant.conversations.inbound')
                    }}
                    · {{ when(m.at) }}
                  </div>
                  <!-- Plain text on purpose: a message is never rendered as HTML. -->
                  <div>{{ m.body }}</div>
                  <div v-if="m.flags.length" class="text-caption text-warning q-mt-xs">
                    <q-icon name="shield" size="14px" /> {{ t('tenant.conversations.flagged') }}
                  </div>
                  <div v-if="m.status === 'failed'" class="text-caption text-negative q-mt-xs">
                    {{ t('tenant.conversations.failed') }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </q-page>
</template>
