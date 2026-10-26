<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ChunkInfo, KnowledgeClient } from '@/api/knowledge';
import IgAlert from '@/components/IgAlert.vue';
import { clip } from '@/utils/knowledge';

const props = defineProps<{ client: KnowledgeClient; documentId: string }>();
const { t } = useI18n();

const chunks = ref<ChunkInfo[]>([]);
const loading = ref(true);
const failed = ref(false);
const open = ref<Set<string>>(new Set());

onMounted(async () => {
  try {
    chunks.value = (await props.client.chunks?.(props.documentId))?.items ?? [];
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
});

function toggle(id: string) {
  const next = new Set(open.value);
  if (!next.delete(id)) next.add(id);
  open.value = next;
}
</script>

<template>
  <div class="q-mt-md">
    <q-skeleton v-if="loading" height="60px" />
    <IgAlert v-else-if="failed" tone="error">{{ t('common.loadError') }}</IgAlert>
    <div v-else-if="!chunks.length" class="ig-muted text-caption">
      {{ t('tenant.knowledge.chunksList.none') }}
    </div>
    <div v-else class="column q-gutter-y-xs">
      <div class="text-caption ig-muted">{{ t('tenant.knowledge.chunksList.hint') }}</div>
      <div v-for="c in chunks" :key="c.id" class="ig-chunk q-pa-sm">
        <div class="row items-center q-gutter-xs">
          <span class="ig-pill ig-pill--brand">#{{ c.position + 1 }}</span>
          <span v-if="c.section" class="ig-pill">{{ c.section }}</span>
          <span class="ig-pill"
            >{{ c.characters }} {{ t('tenant.knowledge.chunksList.chars') }}</span
          >
          <span class="ig-pill" :class="c.embedded ? 'ig-pill--ok' : 'ig-pill--warn'">
            {{
              c.embedded
                ? t('tenant.knowledge.chunksList.embedded')
                : t('tenant.knowledge.chunksList.keywordOnly')
            }}
          </span>
        </div>
        <!-- Text on purpose: it is what a document says. -->
        <div class="q-mt-xs" style="white-space: pre-wrap; word-break: break-word">
          {{ open.has(c.id) ? c.content : clip(c.content) }}
        </div>
        <q-btn
          v-if="c.content.length > 280"
          flat
          dense
          no-caps
          size="sm"
          :label="
            open.has(c.id)
              ? t('tenant.knowledge.chunksList.less')
              : t('tenant.knowledge.chunksList.more')
          "
          @click="toggle(c.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ig-chunk {
  border: 1px solid var(--ig-line);
  border-radius: var(--ig-r-sm);
  background: var(--ig-surface-2);
}
</style>
