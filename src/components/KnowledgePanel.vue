<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { KnowledgeClient } from '@/api/knowledge';
import type { KnowledgeDocument } from '@/api/tenant';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { ACCEPT_ATTR, uploadProblem } from '@/utils/format';

const props = defineProps<{ client: KnowledgeClient }>();
const { t } = useI18n();
const $q = useQuasar();

const docs = ref<KnowledgeDocument[]>([]);
const cursor = ref<string | undefined>();
const loading = ref(false);
const failed = ref(false);
const uploading = ref(false);
const dragging = ref(false);
const picker = ref<HTMLInputElement | null>(null);

const toDelete = ref<KnowledgeDocument | null>(null);
const confirmDelete = computed({
  get: () => toDelete.value !== null,
  set: (v) => {
    if (!v) toDelete.value = null;
  },
});
const confirmAll = ref(false);
const busy = ref(false);

const ICONS: Record<KnowledgeDocument['source_type'], string> = {
  pdf: 'picture_as_pdf',
  docx: 'description',
  xlsx: 'table_chart',
  csv: 'table_rows',
  md: 'article',
  txt: 'notes',
};

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

async function load(more = false) {
  loading.value = true;
  failed.value = false;
  try {
    const page = await props.client.documents(more && cursor.value ? { cursor: cursor.value } : {});
    docs.value = more ? [...docs.value, ...page.items] : page.items;
    cursor.value = page.next_cursor;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

// Indexing happens in the background: look again while anything is still processing.
let timer: ReturnType<typeof setInterval> | undefined;
async function refreshWhileProcessing() {
  if (!docs.value.some((d) => d.status === 'processing') || loading.value) return;
  try {
    const page = await props.client.documents();
    // Keep the pages already loaded; refresh only the first page in place.
    const fresh = new Map(page.items.map((d) => [d.id, d]));
    docs.value = docs.value.map((d) => fresh.get(d.id) ?? d);
  } catch {
    // The next tick tries again.
  }
}

onMounted(() => {
  void load();
  timer = setInterval(() => void refreshWhileProcessing(), 3000);
});
onBeforeUnmount(() => clearInterval(timer));

async function upload(files: FileList | File[] | null | undefined) {
  const list = Array.from(files ?? []);
  if (!list.length) return;
  uploading.value = true;
  try {
    for (const file of list) {
      const problem = uploadProblem(file);
      if (problem) {
        $q.notify({
          type: 'warning',
          message: `${file.name}: ${problem === 'size' ? t('tenant.knowledge.tooBig') : t('tenant.knowledge.badType')}`,
        });
        continue;
      }
      try {
        const doc = await props.client.uploadDocument(file);
        docs.value = [doc, ...docs.value];
        $q.notify({ type: 'positive', message: t('tenant.knowledge.uploaded') });
      } catch {
        $q.notify({ type: 'negative', message: `${file.name}: ${t('common.loadError')}` });
      }
    }
  } finally {
    uploading.value = false;
    if (picker.value) picker.value.value = '';
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  void upload(e.dataTransfer?.files);
}

async function retry(d: KnowledgeDocument) {
  try {
    await props.client.reindexDocument(d.id);
    docs.value = docs.value.map((x) =>
      x.id === d.id ? { ...x, status: 'processing', error: '' } : x,
    );
    $q.notify({ type: 'info', message: t('tenant.knowledge.reindexQueued') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  }
}

async function remove() {
  const d = toDelete.value;
  if (!d) return;
  busy.value = true;
  try {
    await props.client.deleteDocument(d.id);
    docs.value = docs.value.filter((x) => x.id !== d.id);
    toDelete.value = null;
    $q.notify({ type: 'positive', message: t('tenant.knowledge.deleted') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    busy.value = false;
  }
}

async function reindexAll() {
  busy.value = true;
  try {
    await props.client.reindexAll();
    confirmAll.value = false;
    $q.notify({ type: 'info', message: t('tenant.knowledge.reindexQueued') });
    await load();
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <div class="row justify-end q-mb-md">
      <IgButton
        variant="secondary"
        icon="sync"
        :disable="!docs.length"
        :label="t('tenant.knowledge.reindexAll')"
        @click="confirmAll = true"
      />
    </div>

    <input
      ref="picker"
      type="file"
      multiple
      class="hidden"
      :accept="ACCEPT_ATTR"
      @change="upload(($event.target as HTMLInputElement).files)"
    />
    <div
      class="ig-drop q-mb-md"
      :class="{ 'ig-drop--over': dragging }"
      role="button"
      tabindex="0"
      :aria-label="t('tenant.knowledge.upload')"
      @click="picker?.click()"
      @keydown.enter.prevent="picker?.click()"
      @keydown.space.prevent="picker?.click()"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="ig-drop__icon">
        <q-spinner v-if="uploading" size="26px" />
        <q-icon v-else name="upload_file" size="28px" />
      </div>
      <div class="text-subtitle1 text-weight-bold">
        {{ uploading ? t('tenant.knowledge.uploading') : t('tenant.knowledge.dropHint') }}
      </div>
      <div class="text-caption ig-muted">{{ t('tenant.knowledge.dropTypes') }}</div>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load()" />
      </template>
    </IgAlert>

    <q-skeleton v-if="loading && !docs.length" height="88px" />
    <div v-else-if="!docs.length && !failed" class="ig-card">
      <EmptyState
        icon="menu_book"
        :title="t('tenant.knowledge.empty')"
        :hint="t('tenant.knowledge.emptyHint')"
      />
    </div>

    <div class="column no-wrap q-gutter-y-sm">
      <div v-for="d in docs" :key="d.id" class="ig-card q-pa-md">
        <div class="row items-center no-wrap q-gutter-x-md">
          <div class="ig-doc__icon"><q-icon :name="ICONS[d.source_type]" size="24px" /></div>
          <div class="col" style="min-width: 0">
            <div class="text-subtitle1 text-weight-bold ellipsis">{{ d.title }}</div>
            <div class="text-caption ig-muted">
              {{ d.source_type.toUpperCase() }} · {{ d.chunk_count }}
              {{ t('tenant.knowledge.chunks', d.chunk_count) }} ·
              {{ when(d.created_at) }}
            </div>
            <div class="row items-center q-gutter-xs q-mt-xs">
              <span
                class="ig-pill"
                :class="{
                  'ig-pill--ok': d.status === 'ready',
                  'ig-pill--warn': d.status === 'processing',
                }"
                :style="
                  d.status === 'failed'
                    ? 'background: var(--ig-error-bg); color: var(--ig-error)'
                    : ''
                "
              >
                <q-spinner-dots v-if="d.status === 'processing'" size="14px" />
                {{ t(`tenant.knowledge.status.${d.status}`) }}
              </span>
              <span v-if="d.ignored_images > 0" class="ig-pill">
                <q-icon name="image_not_supported" size="13px" />
                {{ d.ignored_images }} {{ t('tenant.knowledge.images', d.ignored_images) }}
              </span>
              <span v-if="d.status === 'ready' && !d.embedding_model" class="ig-pill">
                {{ t('tenant.knowledge.keywordOnly') }}
              </span>
            </div>
            <div
              v-if="d.status === 'failed' && d.error"
              class="text-caption q-mt-xs"
              style="color: var(--ig-error)"
            >
              {{ d.error }}
            </div>
          </div>
          <div class="row no-wrap q-gutter-x-xs">
            <IgButton
              v-if="d.status === 'failed'"
              variant="secondary"
              size="sm"
              icon="refresh"
              :label="t('tenant.knowledge.retry')"
              @click="retry(d)"
            />
            <IgButton
              variant="ghost"
              icon-only
              icon="delete_outline"
              :label="t('common.delete')"
              @click="toDelete = d"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="cursor" class="q-mt-md text-center">
      <IgButton
        variant="ghost"
        :loading="loading"
        :label="t('common.loadMore')"
        @click="load(true)"
      />
    </div>

    <ConfirmDialog
      v-model="confirmDelete"
      destructive
      :loading="busy"
      :title="t('tenant.knowledge.deleteTitle')"
      :message="toDelete ? `${toDelete.title}\n${t('tenant.knowledge.deleteBody')}` : ''"
      :confirm-label="t('common.delete')"
      :cancel-label="t('common.cancel')"
      @confirm="remove"
    />
    <ConfirmDialog
      v-model="confirmAll"
      :loading="busy"
      :title="t('tenant.knowledge.reindexAllTitle')"
      :message="t('tenant.knowledge.reindexAllBody')"
      :confirm-label="t('tenant.knowledge.reindex')"
      :cancel-label="t('common.cancel')"
      @confirm="reindexAll"
    />
  </div>
</template>
