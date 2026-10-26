<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import type { OperationDraft } from '@/utils/connectors';
import { MAX_SPEC_BYTES, parseOpenApi, type OpenApiResult } from '@/utils/openapi';

const { t } = useI18n();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{
  add: [payload: { baseUrl: string | null; operations: OperationDraft[] }];
}>();

const text = ref('');
const result = ref<Extract<OpenApiResult, { ok: true }> | null>(null);
const error = ref('');
const chosen = ref<number[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

// Every opening starts from the beginning.
watch(open, (v) => {
  if (v) reset();
});

function reset() {
  text.value = '';
  result.value = null;
  error.value = '';
  chosen.value = [];
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;
  if (file.size > MAX_SPEC_BYTES) {
    error.value = t('admin.tenant.connectors.import.errors.tooBig');
    return;
  }
  // Read as text only: the file is never run and nothing is fetched from it.
  text.value = await file.text();
  analyse();
}

function analyse() {
  error.value = '';
  const r = parseOpenApi(text.value);
  if (!r.ok) {
    error.value = t(`admin.tenant.connectors.import.errors.${r.error}`);
    return;
  }
  result.value = r;
  chosen.value = r.operations.map((_, i) => i);
}

const count = computed(() => chosen.value.length);

function add() {
  if (!result.value) return;
  const operations = chosen.value
    .slice()
    .sort((a, b) => a - b)
    .flatMap((i) => (result.value?.operations[i] ? [result.value.operations[i].draft] : []));
  emit('add', { baseUrl: result.value.baseUrl, operations });
  open.value = false;
}
</script>

<template>
  <q-dialog v-model="open" :maximized="$q.screen.lt.sm">
    <q-card
      class="ig-card ig-card--raised column no-wrap"
      :style="
        $q.screen.lt.sm
          ? 'border-radius: 0'
          : 'width: 680px; max-width: 94vw; max-height: 90vh; border-radius: 20px'
      "
    >
      <q-card-section>
        <div class="text-h6">{{ t('admin.tenant.connectors.import.title') }}</div>
        <div class="text-caption ig-muted">{{ t('admin.tenant.connectors.import.hint') }}</div>
      </q-card-section>

      <q-card-section class="col q-gutter-y-md" style="overflow-y: auto; min-height: 0">
        <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>

        <!-- 1. The file -->
        <template v-if="!result">
          <q-input
            v-model="text"
            outlined
            type="textarea"
            :rows="10"
            spellcheck="false"
            :label="t('admin.tenant.connectors.import.paste')"
            input-style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px"
          />
          <div class="row items-center q-gutter-x-md">
            <input
              ref="fileInput"
              type="file"
              accept=".json,.yaml,.yml,.txt,application/json,text/yaml"
              class="hidden"
              @change="onFile"
            />
            <IgButton
              variant="secondary"
              icon="upload_file"
              :label="t('admin.tenant.connectors.import.file')"
              @click="fileInput?.click()"
            />
            <span class="text-caption ig-muted">{{
              t('admin.tenant.connectors.import.local')
            }}</span>
          </div>
        </template>

        <!-- 2. What was found -->
        <template v-else>
          <div>
            <div class="text-subtitle1 text-weight-bold">
              {{ result.title || t('admin.tenant.connectors.import.untitled') }}
            </div>
            <div class="text-caption ig-muted">
              {{
                result.baseUrl
                  ? t('admin.tenant.connectors.import.server', { url: result.baseUrl })
                  : t('admin.tenant.connectors.import.noServer')
              }}
            </div>
          </div>

          <div class="ig-eyebrow">
            {{ t('admin.tenant.connectors.import.found', { n: result.operations.length }) }}
          </div>
          <q-list bordered separator style="border-radius: 14px; overflow: hidden">
            <q-item v-for="(o, i) in result.operations" :key="o.source" tag="label">
              <q-item-section side>
                <q-checkbox v-model="chosen" :val="i" color="primary" />
              </q-item-section>
              <q-item-section avatar>
                <span class="ig-pill" style="min-width: 58px; justify-content: center">
                  {{ o.draft.method }}
                </span>
              </q-item-section>
              <q-item-section>
                <!-- Text on purpose: the file comes from outside. -->
                <q-item-label class="ellipsis">{{ o.draft.name }}</q-item-label>
                <q-item-label caption class="ellipsis">
                  {{ o.draft.path }} · {{ o.draft.description }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <q-expansion-item
            v-if="result.skipped.length"
            dense
            :label="t('admin.tenant.connectors.import.skipped', { n: result.skipped.length })"
          >
            <div v-for="s in result.skipped" :key="s.source" class="q-py-xs text-caption">
              <span class="text-weight-medium">{{ s.source }}</span>
              · {{ t(`admin.tenant.connectors.import.reasons.${s.reason}`) }}
            </div>
          </q-expansion-item>
          <IgAlert v-if="result.simplified.length" tone="warn">
            {{
              t('admin.tenant.connectors.import.simplified', {
                words: result.simplified.join(', '),
              })
            }}
          </IgAlert>
          <div class="text-caption ig-muted">{{ t('admin.tenant.connectors.import.review') }}</div>
        </template>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md q-gutter-x-sm">
        <IgButton
          v-if="result"
          variant="ghost"
          :label="t('admin.tenant.connectors.import.back')"
          @click="reset"
        />
        <IgButton variant="ghost" :label="t('common.cancel')" @click="open = false" />
        <IgButton
          v-if="!result"
          variant="primary"
          :disable="!text.trim()"
          :label="t('admin.tenant.connectors.import.analyse')"
          @click="analyse"
        />
        <IgButton
          v-else
          variant="primary"
          :disable="!count"
          :label="t('admin.tenant.connectors.import.add', { n: count })"
          @click="add"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
