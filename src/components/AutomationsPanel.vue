<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  AutomationInput,
  AutomationRule,
  AutomationRun,
  AutomationsClient,
} from '@/api/automations';
import type { Connector } from '@/api/tenant';
import AutomationBuilder from '@/components/AutomationBuilder.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import {
  emptyRule,
  microToUsd,
  ruleToDraft,
  ruleToInput,
  usesAI,
  type RuleDraft,
} from '@/utils/automations';

const props = defineProps<{
  client: AutomationsClient;
  loadConnectors: () => Promise<Connector[]>;
}>();

const { t } = useI18n();
const $q = useQuasar();

type Section = 'plain' | 'ai' | 'runs';
const section = ref<Section>('plain');

const rules = ref<AutomationRule[]>([]);
const connectors = ref<Connector[]>([]);
const loading = ref(true);
const failed = ref(false);
const notIncluded = ref(false);

const codeOf = (e: unknown) => (e as { code?: string }).code;

async function load() {
  loading.value = true;
  failed.value = false;
  notIncluded.value = false;
  try {
    rules.value = (await props.client.list()).items;
  } catch (e) {
    if (codeOf(e) === 'module_not_included') notIncluded.value = true;
    else failed.value = true;
  } finally {
    loading.value = false;
  }
  // The systems of the tenant are only for the steps that call them: not having them is not an error.
  connectors.value = await props.loadConnectors().catch(() => []);
}
onMounted(load);

const shown = computed(() =>
  rules.value.filter((r) => (section.value === 'ai' ? usesAI(r) : !usesAI(r))),
);

// --- the log ------------------------------------------------------------------------------------
const runs = ref<AutomationRun[]>([]);
const runsLoading = ref(false);
const runsFailed = ref(false);
const runsLoaded = ref(false);
const openRun = ref<string | null>(null);

async function loadRuns() {
  runsLoading.value = true;
  runsFailed.value = false;
  try {
    runs.value = (await props.client.runs({ limit: 50 })).items;
    runsLoaded.value = true;
  } catch {
    runsFailed.value = true;
  } finally {
    runsLoading.value = false;
  }
}
watch(section, (s) => {
  if (s === 'runs' && !runsLoaded.value) void loadRuns();
});

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

// --- how a rule reads -----------------------------------------------------------------------------
function triggerText(r: AutomationRule): string {
  const s = r.trigger.schedule;
  if (r.trigger.type !== 'schedule' || !s) return t('tenant.automations.when.message');
  const days = s.weekdays?.length
    ? s.weekdays.map((d) => t(`tenant.automations.day.${d}`)).join(', ')
    : t('tenant.automations.when.everyDay');
  return t('tenant.automations.when.schedule', { at: s.at, days });
}

// --- the builder ----------------------------------------------------------------------------------
const building = ref(false);
const draft = ref<RuleDraft>(emptyRule());
const saving = ref(false);
const apiError = ref('');

function start(r?: AutomationRule) {
  draft.value = r ? ruleToDraft(r) : emptyRule(section.value === 'ai' ? 'ai' : 'plain');
  apiError.value = '';
  building.value = true;
}

function refusal(e: unknown, input: AutomationInput): string {
  const code = codeOf(e);
  if (code === 'module_not_included') {
    return usesAI(input)
      ? t('tenant.automations.notIncludedAi')
      : t('tenant.automations.notIncluded');
  }
  if (code === 'limit_exceeded') return t('tenant.automations.limit');
  if ((e as { status?: number }).status === 400) return t('tenant.automations.saveRejected');
  return t('tenant.automations.saveFailed');
}

async function save(input: AutomationInput) {
  saving.value = true;
  apiError.value = '';
  try {
    const id = draft.value.id;
    const saved = id ? await props.client.replace(id, input) : await props.client.create(input);
    building.value = false;
    $q.notify({ type: 'positive', message: t('tenant.automations.saved') });
    await load();
    // Land on the family of what was just saved.
    section.value = usesAI(saved) ? 'ai' : 'plain';
  } catch (e) {
    apiError.value = refusal(e, input);
  } finally {
    saving.value = false;
  }
}

// --- on / off and delete ------------------------------------------------------------------------------
const busy = ref<string | null>(null);

async function toggle(r: AutomationRule, enabled: boolean) {
  busy.value = r.id;
  try {
    const saved = await props.client.replace(r.id, ruleToInput(r, { enabled }));
    rules.value = rules.value.map((x) => (x.id === r.id ? saved : x));
  } catch (e) {
    $q.notify({ type: 'negative', message: refusal(e, ruleToInput(r)) });
  } finally {
    busy.value = null;
  }
}

const removing = ref<AutomationRule | null>(null);
const confirmOpen = computed({
  get: () => removing.value !== null,
  set: (v) => {
    if (!v) removing.value = null;
  },
});
const deleting = ref(false);

async function remove() {
  const r = removing.value;
  if (!r) return;
  deleting.value = true;
  try {
    await props.client.remove(r.id);
    rules.value = rules.value.filter((x) => x.id !== r.id);
    removing.value = null;
    $q.notify({ type: 'positive', message: t('tenant.automations.deleted') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    deleting.value = false;
  }
}

const statusClass = (s: AutomationRun['status']) =>
  s === 'done'
    ? 'ig-pill--ok'
    : s === 'failed'
      ? 'ig-pill--error'
      : s === 'running'
        ? 'ig-pill--warn'
        : '';
</script>

<template>
  <div>
    <div class="row items-center justify-between q-mb-md q-col-gutter-sm">
      <div class="col-12 col-sm-auto ig-scroll-x">
        <IgSegmented
          v-model="section"
          :label="t('tenant.automations.title')"
          :options="[
            { value: 'plain', label: t('tenant.automations.tabs.plain') },
            { value: 'ai', label: t('tenant.automations.tabs.ai') },
            { value: 'runs', label: t('tenant.automations.tabs.runs') },
          ]"
        />
      </div>
      <div v-if="!notIncluded" class="col-12 col-sm-auto">
        <IgButton
          v-if="section !== 'runs'"
          variant="primary"
          icon="add"
          :label="t('tenant.automations.new')"
          @click="start()"
        />
        <IgButton
          v-else
          variant="secondary"
          icon="refresh"
          :loading="runsLoading"
          :label="t('tenant.automations.refresh')"
          @click="loadRuns"
        />
      </div>
    </div>

    <IgAlert v-if="notIncluded" tone="info">
      {{ t('tenant.automations.notIncluded') }} {{ t('common.managedByIgnis') }}
    </IgAlert>
    <IgAlert v-else-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <template v-else>
      <!-- Rules -->
      <template v-if="section !== 'runs'">
        <p class="ig-muted q-mt-none">
          {{
            section === 'ai' ? t('tenant.automations.aiHint') : t('tenant.automations.plainHint')
          }}
        </p>
        <q-skeleton v-if="loading && !rules.length" height="120px" />
        <div v-else-if="!shown.length" class="ig-card">
          <EmptyState
            :icon="section === 'ai' ? 'auto_awesome' : 'bolt'"
            :title="t(`tenant.automations.empty.${section}`)"
            :hint="t(`tenant.automations.emptyHint.${section}`)"
          />
        </div>

        <div class="column q-gutter-y-md">
          <div v-for="r in shown" :key="r.id" class="ig-card q-pa-lg">
            <div class="row items-center no-wrap q-mb-xs">
              <div class="col">
                <div class="text-subtitle1 text-weight-bold ellipsis">{{ r.name }}</div>
                <div class="text-caption ig-muted">{{ triggerText(r) }}</div>
              </div>
              <span class="ig-pill q-mr-md" :class="r.enabled ? 'ig-pill--ok' : ''">
                {{ r.enabled ? t('tenant.automations.on') : t('tenant.automations.off') }}
              </span>
              <q-toggle
                :model-value="r.enabled"
                :disable="busy === r.id"
                :aria-label="t('tenant.automations.builder.enabled')"
                @update:model-value="(v: boolean) => toggle(r, v)"
              />
            </div>

            <div class="row q-gutter-xs q-my-sm">
              <span v-for="(a, i) in r.actions" :key="i" class="ig-chip" style="cursor: default">
                {{ i + 1 }}. {{ t(`tenant.automations.step.${a.type}.name`) }}
              </span>
            </div>
            <div class="text-caption ig-muted">
              {{ t('tenant.automations.meta', { n: r.version }) }}
              <template v-if="r.cooldown_minutes">
                · {{ t('tenant.automations.cooldown', { n: r.cooldown_minutes }) }}
              </template>
              <template v-if="usesAI(r)">
                ·
                {{
                  t('tenant.automations.budget', { cost: microToUsd(r.ai_budget_micro ?? 100000) })
                }}
              </template>
            </div>

            <div class="row q-gutter-x-sm q-mt-md">
              <IgButton
                variant="secondary"
                size="sm"
                icon="edit"
                :label="t('common.edit')"
                @click="start(r)"
              />
              <IgButton
                variant="ghost"
                size="sm"
                icon="delete_outline"
                :label="t('tenant.automations.delete')"
                @click="removing = r"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- Runs -->
      <template v-else>
        <p class="ig-muted q-mt-none">{{ t('tenant.automations.runsHint') }}</p>
        <IgAlert v-if="runsFailed" tone="error" class="q-mb-md">{{
          t('common.loadError')
        }}</IgAlert>
        <q-skeleton v-if="runsLoading && !runs.length" height="120px" />
        <div v-else-if="!runs.length && runsLoaded" class="ig-card">
          <EmptyState
            icon="history"
            :title="t('tenant.automations.noRuns')"
            :hint="t('tenant.automations.noRunsHint')"
          />
        </div>
        <div v-else class="ig-card" style="overflow: hidden">
          <div v-for="run in runs" :key="run.id">
            <div
              class="ig-row"
              role="button"
              tabindex="0"
              :aria-expanded="openRun === run.id"
              @click="openRun = openRun === run.id ? null : run.id"
              @keydown.enter="openRun = openRun === run.id ? null : run.id"
            >
              <div class="col" style="min-width: 0">
                <div class="text-weight-medium ellipsis">{{ run.rule_name || '—' }}</div>
                <div class="text-caption ig-muted">
                  {{ when(run.started_at) }}
                  <template v-if="run.ai_cost_micro > 0"
                    >· {{ microToUsd(run.ai_cost_micro) }}</template
                  >
                </div>
              </div>
              <span class="ig-pill" :class="statusClass(run.status)">
                {{ t(`tenant.automations.status.${run.status}`) }}
              </span>
              <q-icon :name="openRun === run.id ? 'expand_less' : 'expand_more'" class="q-ml-sm" />
            </div>
            <div v-if="openRun === run.id" class="q-px-md q-pb-md">
              <div v-for="(s, i) in run.steps" :key="i" class="row items-start no-wrap q-py-xs">
                <q-icon
                  :name="s.ok ? 'check_circle' : 'cancel'"
                  size="18px"
                  :color="s.ok ? 'positive' : 'negative'"
                  class="q-mr-sm q-mt-xs"
                />
                <div class="col">
                  <div class="text-caption text-weight-bold">
                    {{ t(`tenant.automations.step.${s.action}.name`) }}
                    <template v-if="s.cost_micro">· {{ microToUsd(s.cost_micro) }}</template>
                  </div>
                  <!-- Text on purpose: nothing of a message is ever shown as HTML. -->
                  <div class="text-caption ig-muted">{{ s.detail }}</div>
                </div>
              </div>
              <div v-if="!run.steps.length" class="text-caption ig-muted">
                {{ t('tenant.automations.noSteps') }}
              </div>
              <IgAlert v-if="run.error" tone="error" class="q-mt-sm">{{ run.error }}</IgAlert>
            </div>
          </div>
        </div>
      </template>
    </template>

    <ConfirmDialog
      v-model="confirmOpen"
      destructive
      :loading="deleting"
      :title="t('tenant.automations.deleteTitle', { name: removing?.name ?? '' })"
      :message="t('tenant.automations.deleteBody')"
      :confirm-label="t('tenant.automations.delete')"
      :cancel-label="t('common.cancel')"
      @confirm="remove"
    />

    <q-dialog v-model="building" persistent :maximized="$q.screen.lt.md">
      <q-card
        class="ig-card ig-card--raised column no-wrap"
        :style="
          $q.screen.lt.md
            ? 'border-radius: 0; width: 100vw'
            : 'width: 920px; max-width: 94vw; height: 90vh; border-radius: 20px'
        "
      >
        <div class="row items-center q-px-md q-pt-md">
          <div class="col text-h6">
            {{
              draft.id
                ? t('tenant.automations.builder.titleEdit')
                : t('tenant.automations.builder.titleNew')
            }}
          </div>
          <IgButton
            variant="ghost"
            size="sm"
            icon-only
            icon="close"
            :disable="saving"
            :label="t('common.cancel')"
            @click="building = false"
          />
        </div>
        <AutomationBuilder
          v-model="draft"
          class="col"
          :connectors="connectors"
          :saving="saving"
          :api-error="apiError"
          :test="(rule, event) => client.test(rule, event)"
          @save="save"
          @cancel="building = false"
        />
      </q-card>
    </q-dialog>
  </div>
</template>
