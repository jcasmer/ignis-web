<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { KnowledgeClient, KnowledgeOptions } from '@/api/knowledge';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { choiceOf, choiceValue, type Try } from '@/utils/knowledge';

const props = defineProps<{ client: KnowledgeClient }>();
const { t } = useI18n();
const $q = useQuasar();

const view = ref<KnowledgeOptions | null>(null);
const failed = ref(false);
const saving = ref(false);

const rewrite = ref<Try>('default');
const rerank = ref<Try>('default');
const ownCut = ref(false);
const cut = ref('');

function load(v: KnowledgeOptions) {
  view.value = v;
  rewrite.value = choiceOf(v.rewrite.own);
  rerank.value = choiceOf(v.rerank.own);
  ownCut.value = v.min_similarity.own !== null;
  cut.value = String(v.min_similarity.own ?? v.min_similarity.default);
}

onMounted(async () => {
  try {
    const v = await props.client.getOptions?.();
    if (v) load(v);
  } catch {
    failed.value = true;
  }
});

const cutNumber = computed(() => Number(cut.value.replace(',', '.')));
const cutValid = computed(
  () => !ownCut.value || (cut.value.trim() !== '' && cutNumber.value >= 0 && cutNumber.value <= 1),
);

const stateText = (on: boolean) =>
  on ? t('tenant.knowledge.options.on') : t('tenant.knowledge.options.off');
const choices = (def: boolean) => [
  { value: 'default', label: t('tenant.knowledge.options.follow', { v: stateText(def) }) },
  { value: 'on', label: t('tenant.knowledge.options.forceOn') },
  { value: 'off', label: t('tenant.knowledge.options.forceOff') },
];

async function save() {
  if (!cutValid.value || !props.client.putOptions) return;
  saving.value = true;
  try {
    load(
      await props.client.putOptions({
        rewrite: choiceValue(rewrite.value),
        rerank: choiceValue(rerank.value),
        min_similarity: ownCut.value ? cutNumber.value : null,
      }),
    );
    $q.notify({ type: 'positive', message: t('tenant.knowledge.options.saved') });
  } catch {
    $q.notify({ type: 'negative', message: t('tenant.knowledge.options.refused') });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="ig-card q-pa-md q-mb-md">
    <div class="text-subtitle1 text-weight-bold">{{ t('tenant.knowledge.options.title') }}</div>
    <p class="ig-muted text-caption q-mt-xs q-mb-md">{{ t('tenant.knowledge.options.intro') }}</p>

    <IgAlert v-if="failed" tone="error">{{ t('common.loadError') }}</IgAlert>
    <q-skeleton v-else-if="!view" height="120px" />
    <template v-else>
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-6">
          <q-select
            v-model="rewrite"
            dense
            outlined
            emit-value
            map-options
            :disable="!view.rewrite.available"
            :options="choices(view.rewrite.default)"
            :label="t('tenant.knowledge.options.rewrite')"
            :hint="
              view.rewrite.available
                ? t('tenant.knowledge.options.rewriteHint')
                : t('tenant.knowledge.options.needsModel')
            "
          />
        </div>
        <div class="col-12 col-md-6">
          <q-select
            v-model="rerank"
            dense
            outlined
            emit-value
            map-options
            :disable="!view.rerank.available"
            :options="choices(view.rerank.default)"
            :label="t('tenant.knowledge.options.rerank')"
            :hint="
              view.rerank.available
                ? t('tenant.knowledge.options.rerankHint')
                : t('tenant.knowledge.options.needsModel')
            "
          />
        </div>
        <div class="col-12">
          <q-toggle
            v-model="ownCut"
            dense
            :label="t('tenant.knowledge.options.ownCut', { v: view.min_similarity.default })"
          />
          <q-input
            v-if="ownCut"
            v-model="cut"
            dense
            outlined
            class="q-mt-sm"
            style="max-width: 220px"
            inputmode="decimal"
            :error="!cutValid"
            :error-message="t('tenant.knowledge.options.cutInvalid')"
            :label="t('tenant.knowledge.options.cut')"
            :hint="t('tenant.knowledge.options.cutHint')"
          />
        </div>
      </div>
      <p class="text-caption ig-muted q-mt-md q-mb-sm">{{ t('tenant.knowledge.options.cost') }}</p>
      <IgButton
        variant="primary"
        icon="save"
        :loading="saving"
        :disable="!cutValid"
        :label="t('common.save')"
        @click="save"
      />
    </template>
  </div>
</template>
