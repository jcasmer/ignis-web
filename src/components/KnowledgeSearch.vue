<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { KnowledgeClient, SearchResult } from '@/api/knowledge';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { clip, scoreText } from '@/utils/knowledge';

const props = defineProps<{ client: KnowledgeClient }>();
const { t } = useI18n();

const q = ref('');
const limit = ref(5);
const running = ref(false);
const failed = ref(false);
const result = ref<SearchResult | null>(null);
const asked = ref('');

async function run() {
  const text = q.value.trim();
  if (!text || !props.client.search) return;
  running.value = true;
  failed.value = false;
  try {
    result.value = await props.client.search(text, limit.value);
    asked.value = text;
  } catch {
    failed.value = true;
    result.value = null;
  } finally {
    running.value = false;
  }
}

const rank = (n: number) => (n > 0 ? `#${n}` : '—');
</script>

<template>
  <div class="ig-card q-pa-md q-mb-md">
    <div class="text-subtitle1 text-weight-bold">{{ t('tenant.knowledge.inspect.title') }}</div>
    <p class="ig-muted text-caption q-mt-xs q-mb-sm">{{ t('tenant.knowledge.inspect.intro') }}</p>
    <div class="row q-col-gutter-sm items-start">
      <div class="col-12 col-sm">
        <q-input
          v-model="q"
          dense
          outlined
          maxlength="1000"
          :label="t('tenant.knowledge.inspect.query')"
          @keydown.enter.prevent="run"
        />
      </div>
      <div class="col-6 col-sm-2">
        <q-select
          v-model="limit"
          dense
          outlined
          :options="[3, 5, 8, 10]"
          :label="t('tenant.knowledge.inspect.limit')"
        />
      </div>
      <div class="col-6 col-sm-auto">
        <IgButton
          variant="primary"
          icon="manage_search"
          :loading="running"
          :disable="!q.trim()"
          :label="t('tenant.knowledge.inspect.run')"
          @click="run"
        />
      </div>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mt-md">{{ t('common.loadError') }}</IgAlert>

    <template v-if="result">
      <IgAlert v-if="!result.by_meaning" tone="warn" class="q-mt-md">
        {{ t('tenant.knowledge.inspect.keywordsOnly') }}
      </IgAlert>
      <div v-if="!result.items.length" class="ig-muted q-mt-md">
        {{ t('tenant.knowledge.inspect.none', { q: asked }) }}
      </div>
      <div v-else class="column q-gutter-y-sm q-mt-sm">
        <div class="text-caption ig-muted">{{ t('tenant.knowledge.inspect.scoreHint') }}</div>
        <div v-for="(h, i) in result.items" :key="h.chunk_id" class="ig-card q-pa-sm">
          <div class="row items-center q-gutter-xs">
            <span class="ig-pill ig-pill--brand">#{{ i + 1 }}</span>
            <span class="ig-pill"
              >{{ t('tenant.knowledge.inspect.score') }} {{ scoreText(h.score) }}</span
            >
            <span class="ig-pill" :class="{ 'ig-pill--ok': h.vector_rank > 0 }">
              {{ t('tenant.knowledge.inspect.byMeaning') }} {{ rank(h.vector_rank) }}
            </span>
            <span class="ig-pill" :class="{ 'ig-pill--ok': h.keyword_rank > 0 }">
              {{ t('tenant.knowledge.inspect.byKeywords') }} {{ rank(h.keyword_rank) }}
            </span>
          </div>
          <div class="text-caption text-weight-bold q-mt-xs">
            {{ h.document_title }}<template v-if="h.section"> · {{ h.section }}</template>
          </div>
          <!-- Text on purpose: it is what a document says. -->
          <div style="white-space: pre-wrap; word-break: break-word">
            {{ clip(h.content, 400) }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
