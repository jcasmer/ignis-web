<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ConversationMessage, ConversationSummary, Handoff } from '@/api/tenant';
import { useSessionStore } from '@/stores/session';
import IgButton from '@/components/IgButton.vue';
import IgAlert from '@/components/IgAlert.vue';
import EmptyState from '@/components/EmptyState.vue';

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
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.conversations') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.conversations.title') }}</h1>
    </div>

    <div class="row q-col-gutter-md">
      <!-- On a phone only one of the two panes shows at a time. -->
      <div class="col-12 col-md-5 col-lg-4" :class="{ 'gt-sm': selected }">
        <div class="ig-card" style="overflow: hidden">
          <IgAlert v-if="failed" tone="error" class="q-ma-md">
            {{ t('common.loadError') }}
            <template #action>
              <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="loadList()" />
            </template>
          </IgAlert>
          <button
            v-for="c in list"
            :key="c.id"
            type="button"
            class="ig-row"
            :aria-current="selected?.id === c.id"
            @click="open(c)"
          >
            <span class="ig-avatar">{{ nameOf(c).charAt(0).toUpperCase() }}</span>
            <span class="col" style="min-width: 0">
              <span class="row items-center no-wrap">
                <span class="text-weight-bold ellipsis col">{{ nameOf(c) }}</span>
                <span class="text-caption ig-muted q-ml-sm">
                  {{
                    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(
                      new Date(c.last_message_at),
                    )
                  }}
                </span>
              </span>
              <span class="row items-center no-wrap q-mt-xs">
                <q-icon
                  :name="c.last_direction === 'in' ? 'south_west' : 'north_east'"
                  size="14px"
                  class="ig-muted q-mr-xs"
                />
                <span class="ellipsis text-body2 ig-muted col">{{ c.last_message }}</span>
                <span v-if="c.handoff_active" class="ig-pill ig-pill--brand q-ml-sm">
                  <q-icon name="support_agent" size="13px" />
                </span>
              </span>
            </span>
          </button>
          <div v-if="loadingList && !list.length" class="q-pa-md">
            <q-skeleton v-for="n in 5" :key="n" height="52px" class="q-mb-sm" />
          </div>
          <EmptyState v-else-if="!list.length && !failed" icon="forum" :title="t('common.empty')" />
          <div v-if="listCursor" class="q-pa-sm text-center">
            <IgButton
              variant="ghost"
              size="sm"
              :loading="loadingList"
              :label="t('common.loadMore')"
              @click="loadList(true)"
            />
          </div>
        </div>
      </div>

      <div class="col-12 col-md-7 col-lg-8" :class="{ 'gt-sm': !selected }">
        <div class="ig-card" style="min-height: 420px; overflow: hidden">
          <EmptyState
            v-if="!selected"
            icon="chat_bubble_outline"
            :title="t('tenant.conversations.select')"
          />
          <template v-else>
            <div
              class="row items-center no-wrap q-pa-md"
              style="border-bottom: 1px solid var(--ig-line)"
            >
              <IgButton
                class="lt-md q-mr-sm"
                variant="ghost"
                icon-only
                icon="arrow_back"
                :label="t('common.back')"
                @click="selected = null"
              />
              <span class="ig-avatar q-mr-md">{{ nameOf(selected).charAt(0).toUpperCase() }}</span>
              <div class="col" style="min-width: 0">
                <div class="text-subtitle1 text-weight-bold ellipsis">{{ nameOf(selected) }}</div>
                <div class="text-caption ig-muted ellipsis">
                  {{ selected.contact.channel }} · {{ selected.contact.external_id }}
                </div>
              </div>
              <span v-if="selected.status === 'closed'" class="ig-pill">
                {{ t('tenant.conversations.closed') }}
              </span>
            </div>

            <IgAlert v-if="handoff" tone="warn" class="q-ma-md">
              <div class="text-weight-bold">{{ t('tenant.conversations.handoffActive') }}</div>
              <div class="text-caption" style="opacity: 0.85">
                {{ t('tenant.conversations.expiresAt') }}: {{ when(handoff.expires_at) }}
              </div>
              <template #action>
                <IgButton
                  variant="primary"
                  size="sm"
                  :loading="closing"
                  :label="t('tenant.conversations.returnToAssistant')"
                  @click="giveBack"
                />
              </template>
            </IgAlert>

            <div
              ref="thread"
              class="q-pa-md column no-wrap q-gutter-y-sm"
              style="max-height: 62vh; overflow-y: auto"
            >
              <div v-if="olderCursor" class="text-center">
                <IgButton
                  variant="ghost"
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
                  class="ig-bubble"
                  :class="m.direction === 'out' ? 'ig-bubble--out' : 'ig-bubble--in'"
                >
                  <div class="ig-bubble__meta">
                    {{
                      m.direction === 'out'
                        ? t('tenant.conversations.outbound')
                        : t('tenant.conversations.inbound')
                    }}
                    · {{ when(m.at) }}
                  </div>
                  <!-- Plain text on purpose: a message is never rendered as HTML. -->
                  <div>{{ m.body }}</div>
                  <div
                    v-if="m.flags.length"
                    class="text-caption q-mt-xs"
                    style="color: var(--ig-warn)"
                  >
                    <q-icon name="shield" size="14px" /> {{ t('tenant.conversations.flagged') }}
                  </div>
                  <div
                    v-if="m.status === 'failed'"
                    class="text-caption q-mt-xs"
                    style="color: var(--ig-error)"
                  >
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
