<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ModelPriceItem } from '@/api/ops';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { useSessionStore } from '@/stores/session';
import {
  groupByModel,
  PROVIDER_LABEL,
  PROVIDERS,
  toPriceBody,
  today,
  type PriceForm,
} from '@/utils/prices';
import { formatMicroUsdPrecise } from '@/utils/stats';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const items = ref<ModelPriceItem[]>([]);
const loading = ref(true);
const failed = ref(false);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    items.value = (await session.ops.modelPrices()).items;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const providerOptions = PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABEL[p] ?? p }));
const groups = computed(() => groupByModel(items.value));
const providers = computed(() =>
  [...new Set(groups.value.map((g) => g.provider))].map((p) => ({
    provider: p,
    models: groups.value.filter((g) => g.provider === p),
  })),
);

const date = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso));

// --- the starting catalogue --------------------------------------------------------
const seeding = ref(false);
async function seed() {
  seeding.value = true;
  try {
    const r = await session.ops.seedModelPrices();
    $q.notify({
      type: 'positive',
      message: r.created
        ? t('admin.prices.seeded', { n: r.created })
        : t('admin.prices.nothingToSeed'),
    });
    await load();
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    seeding.value = false;
  }
}

// --- a new price ---------------------------------------------------------------------
const editing = ref(false);
const locked = ref(false);
const saving = ref(false);
const error = ref('');
const blank = (): PriceForm => ({
  provider: 'anthropic',
  model: '',
  input: '',
  output: '',
  start: 'now',
  from: '',
  sourceUrl: '',
  verifiedOn: today(),
});
const form = ref<PriceForm>(blank());

/** A new model, or a change to one that exists (the old price is kept as history). */
function start(from?: { provider: string; model: string; source_url: string }) {
  form.value = blank();
  locked.value = !!from;
  if (from) {
    form.value.provider = from.provider;
    form.value.model = from.model;
    form.value.sourceUrl = from.source_url;
  }
  error.value = '';
  editing.value = true;
}

async function save() {
  error.value = '';
  const r = toPriceBody(form.value);
  if (!r.ok) {
    error.value = t(`admin.prices.errors.${r.error}`);
    return;
  }
  saving.value = true;
  try {
    await session.ops.addModelPrice(r.body);
    editing.value = false;
    $q.notify({ type: 'positive', message: t('admin.prices.saved') });
    await load();
  } catch {
    error.value = t('admin.prices.saveFailed');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <q-page padding>
    <div class="row items-end justify-between q-mb-lg q-col-gutter-md">
      <div class="col-12 col-sm">
        <div class="ig-eyebrow q-mb-xs">{{ t('admin.nav.prices') }}</div>
        <h1 class="text-h4 q-my-none">{{ t('admin.prices.title') }}</h1>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('admin.prices.intro') }}</p>
      </div>
      <div class="col-12 col-sm-auto row q-gutter-sm">
        <IgButton
          variant="secondary"
          icon="cloud_download"
          :loading="seeding"
          :label="t('admin.prices.seed')"
          @click="seed"
        />
        <IgButton variant="primary" icon="add" :label="t('admin.prices.add')" @click="start()" />
      </div>
    </div>

    <IgAlert tone="info" class="q-mb-md">{{ t('admin.prices.rule') }}</IgAlert>
    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <q-skeleton v-if="loading && !items.length" height="160px" />
    <div v-else-if="!items.length && !failed" class="ig-card">
      <EmptyState
        icon="sell"
        :title="t('admin.prices.empty')"
        :hint="t('admin.prices.emptyHint')"
      />
    </div>

    <div v-for="p in providers" :key="p.provider" class="q-mb-lg">
      <div class="ig-section-title q-mb-sm">{{ PROVIDER_LABEL[p.provider] ?? p.provider }}</div>
      <div class="row q-col-gutter-md">
        <div v-for="g in p.models" :key="g.model" class="col-12 col-md-6 col-xl-4">
          <div class="ig-card q-pa-lg full-height column no-wrap">
            <div class="row items-center justify-between q-mb-sm no-wrap">
              <div class="text-subtitle1 text-weight-bold ellipsis">{{ g.model }}</div>
              <span v-if="!g.current" class="ig-pill ig-pill--warn">
                {{ t('admin.prices.notYet') }}
              </span>
            </div>

            <div v-if="g.current" class="row q-col-gutter-md q-mb-sm">
              <div class="col-6">
                <div class="ig-eyebrow q-mb-xs">{{ t('admin.prices.input') }}</div>
                <div class="text-h6 ig-num">
                  {{ formatMicroUsdPrecise(g.current.input_micro_per_mtok) }}
                </div>
              </div>
              <div class="col-6">
                <div class="ig-eyebrow q-mb-xs">{{ t('admin.prices.output') }}</div>
                <div class="text-h6 ig-num">
                  {{ formatMicroUsdPrecise(g.current.output_micro_per_mtok) }}
                </div>
              </div>
            </div>
            <div v-if="g.current" class="text-caption ig-muted q-mb-sm">
              {{
                t('admin.prices.since', {
                  date: date(g.current.effective_from),
                  verified: date(g.current.verified_on),
                })
              }}
              <a :href="g.current.source_url" target="_blank" rel="noopener noreferrer">
                {{ t('admin.prices.source') }}
              </a>
            </div>

            <div
              v-for="s in g.scheduled"
              :key="s.effective_from"
              class="q-pa-sm q-mb-sm"
              style="background: var(--ig-surface-2); border-radius: 12px"
            >
              <div class="text-caption text-weight-bold">
                {{ t('admin.prices.from', { date: date(s.effective_from) }) }}
              </div>
              <div class="text-caption ig-num">
                {{ formatMicroUsdPrecise(s.input_micro_per_mtok) }} ·
                {{ formatMicroUsdPrecise(s.output_micro_per_mtok) }}
              </div>
            </div>

            <div class="q-mt-auto q-pt-sm">
              <IgButton
                variant="secondary"
                block
                icon="edit"
                :label="t('admin.prices.change')"
                @click="start(g.current ?? { ...g, source_url: '' })"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <q-dialog v-model="editing" :persistent="saving">
      <q-card
        class="ig-card ig-card--raised"
        style="width: 520px; max-width: 94vw; border-radius: 20px"
      >
        <q-form @submit.prevent="save">
          <q-card-section>
            <div class="text-h6">
              {{ locked ? t('admin.prices.changeTitle') : t('admin.prices.add') }}
            </div>
            <div v-if="locked" class="text-caption ig-muted">
              {{ t('admin.prices.changeHint') }}
            </div>
          </q-card-section>
          <q-card-section class="q-gutter-y-md">
            <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-5">
                <q-select
                  v-model="form.provider"
                  outlined
                  emit-value
                  map-options
                  :disable="locked"
                  :options="providerOptions"
                  :label="t('admin.prices.provider')"
                />
              </div>
              <div class="col-12 col-sm-7">
                <q-input
                  v-model="form.model"
                  outlined
                  maxlength="100"
                  :autofocus="!locked"
                  :readonly="locked"
                  :label="t('admin.prices.model')"
                  :hint="t('admin.prices.modelHint')"
                />
              </div>
            </div>
            <div class="row q-col-gutter-md">
              <div class="col-6">
                <q-input
                  v-model="form.input"
                  outlined
                  inputmode="decimal"
                  :autofocus="locked"
                  :label="t('admin.prices.inputUsd')"
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model="form.output"
                  outlined
                  inputmode="decimal"
                  :label="t('admin.prices.outputUsd')"
                />
              </div>
            </div>
            <div>
              <q-option-group
                v-model="form.start"
                inline
                :options="[
                  { value: 'now', label: t('admin.prices.startNow') },
                  { value: 'date', label: t('admin.prices.startDate') },
                ]"
              />
              <q-input
                v-if="form.start === 'date'"
                v-model="form.from"
                outlined
                type="date"
                class="q-mt-sm"
                :label="t('admin.prices.startsOn')"
              />
            </div>
            <q-input
              v-model="form.sourceUrl"
              outlined
              inputmode="url"
              :label="t('admin.prices.sourceUrl')"
              :hint="t('admin.prices.sourceHint')"
            />
            <q-input
              v-model="form.verifiedOn"
              outlined
              type="date"
              :max="today()"
              :label="t('admin.prices.verifiedOn')"
            />
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md q-gutter-x-sm">
            <IgButton
              variant="ghost"
              :disable="saving"
              :label="t('common.cancel')"
              @click="editing = false"
            />
            <IgButton
              type="submit"
              variant="primary"
              :loading="saving"
              :label="t('admin.prices.save')"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>
