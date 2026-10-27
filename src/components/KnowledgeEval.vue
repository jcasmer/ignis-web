<script setup lang="ts">
import { useQuasar } from 'quasar';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { EvalCase, EvalReport, KnowledgeClient } from '@/api/knowledge';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';

const props = defineProps<{ client: KnowledgeClient }>();
const { t } = useI18n();
const $q = useQuasar();

const cases = ref<EvalCase[]>([]);
const loading = ref(true);
const failed = ref(false);

const question = ref('');
const expect = ref('');
const nothing = ref(false);
const adding = ref(false);

const limit = ref(5);
const tryMin = ref('');
const running = ref(false);
const report = ref<EvalReport | null>(null);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    cases.value = (await props.client.evalCases?.())?.items ?? [];
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const canAdd = () => question.value.trim() !== '' && (nothing.value || expect.value.trim() !== '');

async function add() {
  if (!canAdd() || !props.client.addEvalCase) return;
  adding.value = true;
  try {
    const c = await props.client.addEvalCase(
      question.value.trim(),
      nothing.value ? '' : expect.value.trim(),
    );
    cases.value = [...cases.value, c];
    question.value = '';
    expect.value = '';
    nothing.value = false;
    $q.notify({ type: 'positive', message: t('tenant.knowledge.eval.added') });
  } catch (e) {
    const code = (e as { code?: string }).code;
    $q.notify({
      type: 'negative',
      message:
        code === 'limit_exceeded' ? t('tenant.knowledge.eval.tooMany') : t('common.loadError'),
    });
  } finally {
    adding.value = false;
  }
}

async function remove(c: EvalCase) {
  try {
    await props.client.deleteEvalCase?.(c.id);
    cases.value = cases.value.filter((x) => x.id !== c.id);
    report.value = null;
    $q.notify({ type: 'positive', message: t('tenant.knowledge.eval.deleted') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  }
}

async function run() {
  if (!props.client.runEval) return;
  const raw = tryMin.value.trim();
  const min = raw === '' ? undefined : Number(raw.replace(',', '.'));
  if (min !== undefined && !(min >= 0 && min <= 1)) {
    $q.notify({ type: 'negative', message: t('tenant.knowledge.eval.tryMinHint') });
    return;
  }
  running.value = true;
  try {
    report.value = await props.client.runEval(limit.value, min);
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    running.value = false;
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const resultFor = (id: string) => report.value?.results.find((r) => r.case.id === id);
const gave = (n: number) =>
  n === 0
    ? t('tenant.knowledge.eval.gaveNone')
    : n === 1
      ? t('tenant.knowledge.eval.gaveOne')
      : t('tenant.knowledge.eval.gave', { n });
</script>

<template>
  <div class="ig-card q-pa-md q-mb-md">
    <div class="text-subtitle1 text-weight-bold">{{ t('tenant.knowledge.eval.title') }}</div>
    <p class="ig-muted text-caption q-mt-xs q-mb-md">{{ t('tenant.knowledge.eval.intro') }}</p>

    <div class="row q-col-gutter-sm items-start">
      <div class="col-12 col-md-5">
        <q-input
          v-model="question"
          dense
          outlined
          maxlength="500"
          :label="t('tenant.knowledge.eval.question')"
        />
      </div>
      <div class="col-12 col-md-4">
        <q-input
          v-model="expect"
          dense
          outlined
          maxlength="200"
          :disable="nothing"
          :label="t('tenant.knowledge.eval.expect')"
          :hint="t('tenant.knowledge.eval.expectHint')"
        />
      </div>
      <div class="col-12 col-md-auto">
        <IgButton
          variant="secondary"
          icon="add"
          :loading="adding"
          :disable="!canAdd()"
          :label="t('tenant.knowledge.eval.add')"
          @click="add"
        />
      </div>
    </div>
    <q-toggle v-model="nothing" dense class="q-mt-sm" :label="t('tenant.knowledge.eval.nothing')" />
    <div v-if="nothing" class="text-caption ig-muted">
      {{ t('tenant.knowledge.eval.nothingHint') }}
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mt-md">{{ t('common.loadError') }}</IgAlert>
    <q-skeleton v-else-if="loading" height="60px" class="q-mt-md" />
    <div v-else-if="!cases.length" class="q-mt-md ig-muted">
      <div class="text-weight-bold">{{ t('tenant.knowledge.eval.empty') }}</div>
      <div class="text-caption">{{ t('tenant.knowledge.eval.emptyHint') }}</div>
    </div>

    <template v-else>
      <div class="row q-col-gutter-sm items-start q-mt-md">
        <div class="col-6 col-sm-3">
          <q-select
            v-model="limit"
            dense
            outlined
            :options="[3, 5, 8, 10]"
            :label="t('tenant.knowledge.eval.limit')"
          />
        </div>
        <div class="col-6 col-sm-3">
          <q-input
            v-model="tryMin"
            dense
            outlined
            inputmode="decimal"
            :label="t('tenant.knowledge.eval.tryMin')"
            :hint="t('tenant.knowledge.eval.tryMinHint')"
          />
        </div>
        <div class="col-12 col-sm-auto">
          <IgButton
            variant="primary"
            icon="fact_check"
            :loading="running"
            :label="t('tenant.knowledge.eval.run')"
            @click="run"
          />
        </div>
      </div>

      <template v-if="report">
        <IgAlert v-if="!report.by_meaning" tone="warn" class="q-mt-md">
          {{ t('tenant.knowledge.eval.keywordsOnly') }}
        </IgAlert>
        <div class="row q-col-gutter-sm q-mt-xs">
          <div class="col-6 col-sm-3">
            <div class="ig-card q-pa-sm text-center">
              <div class="text-h5 text-weight-bold">{{ report.passed }}/{{ report.total }}</div>
              <div class="text-caption ig-muted">{{ t('tenant.knowledge.eval.passed') }}</div>
            </div>
          </div>
          <div class="col-6 col-sm-3">
            <div
              class="ig-card q-pa-sm text-center"
              :title="t('tenant.knowledge.eval.hitRateHint')"
            >
              <div class="text-h5 text-weight-bold">{{ pct(report.hit_rate) }}</div>
              <div class="text-caption ig-muted">{{ t('tenant.knowledge.eval.hitRate') }}</div>
            </div>
          </div>
          <div class="col-6 col-sm-3">
            <div class="ig-card q-pa-sm text-center" :title="t('tenant.knowledge.eval.mrrHint')">
              <div class="text-h5 text-weight-bold">{{ report.mrr.toFixed(2) }}</div>
              <div class="text-caption ig-muted">{{ t('tenant.knowledge.eval.mrr') }}</div>
            </div>
          </div>
          <div class="col-6 col-sm-3">
            <div class="ig-card q-pa-sm text-center" :title="t('tenant.knowledge.eval.silentHint')">
              <div class="text-h5 text-weight-bold">
                {{ report.silent }}/{{ report.unanswerable }}
              </div>
              <div class="text-caption ig-muted">{{ t('tenant.knowledge.eval.silent') }}</div>
            </div>
          </div>
        </div>
        <div class="text-caption ig-muted q-mt-xs">
          {{
            report.by_meaning
              ? t('tenant.knowledge.eval.cutUsed', { v: report.min_similarity })
              : ''
          }}
        </div>
      </template>

      <div class="column q-gutter-y-xs q-mt-md">
        <div v-for="c in cases" :key="c.id" class="ig-eval-row q-pa-sm">
          <div class="row items-start no-wrap q-gutter-x-sm">
            <q-icon
              v-if="resultFor(c.id)"
              :name="resultFor(c.id)?.passed ? 'check_circle' : 'cancel'"
              size="22px"
              :color="resultFor(c.id)?.passed ? 'positive' : 'warning'"
              class="q-mt-xs"
            />
            <div class="col" style="min-width: 0">
              <!-- Text on purpose: it is what the team wrote. -->
              <div class="text-weight-bold" style="word-break: break-word">{{ c.question }}</div>
              <div class="text-caption ig-muted" style="word-break: break-word">
                {{
                  c.expect
                    ? t('tenant.knowledge.eval.expects', { t: c.expect })
                    : t('tenant.knowledge.eval.expectsNothing')
                }}
              </div>
              <div v-if="resultFor(c.id)" class="row items-center q-gutter-xs q-mt-xs">
                <span
                  v-if="c.expect"
                  class="ig-pill"
                  :class="(resultFor(c.id)?.rank ?? 0) > 0 ? 'ig-pill--ok' : 'ig-pill--warn'"
                >
                  {{
                    (resultFor(c.id)?.rank ?? 0) > 0
                      ? t('tenant.knowledge.eval.rank', { n: resultFor(c.id)?.rank })
                      : t('tenant.knowledge.eval.notFound')
                  }}
                </span>
                <span class="ig-pill">{{ gave(resultFor(c.id)?.found ?? 0) }}</span>
                <span v-if="(resultFor(c.id)?.top_similarity ?? 0) > 0" class="ig-pill">
                  {{ t('tenant.knowledge.eval.topSimilarity') }}
                  {{ resultFor(c.id)?.top_similarity.toFixed(3) }}
                </span>
              </div>
            </div>
            <IgButton
              variant="ghost"
              icon-only
              icon="delete_outline"
              :label="t('common.delete')"
              @click="remove(c)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ig-eval-row {
  border: 1px solid var(--ig-line);
  border-radius: var(--ig-r-sm);
  background: var(--ig-surface-2);
}
</style>
