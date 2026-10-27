<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  AutomationInput,
  AutomationRule,
  AutomationRun,
  AutomationsClient,
  ModelProvider,
} from '@/api/automations';
import type { Connector } from '@/api/tenant';
import type { WhatsAppTemplate } from '@/api/whatsapp';
import AutomationBuilder from '@/components/AutomationBuilder.vue';
import AutomationTemplates from '@/components/AutomationTemplates.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { refreshOnFocus } from '@/composables/refreshOnFocus';
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
  /** The WhatsApp templates a step can write with. Optional: without it none can be chosen. */
  loadTemplates?: () => Promise<WhatsAppTemplate[]>;
  /** Seen by the Ignis team, not by the customer: the texts say how to fix it, not whom to ask. */
  operator?: boolean;
}>();
provide('automationsOperatorView', props.operator === true);

const { t } = useI18n();
const $q = useQuasar();

type Section = 'plain' | 'ai' | 'runs';
const section = ref<Section>('plain');

const rules = ref<AutomationRule[]>([]);
const connectors = ref<Connector[]>([]);
const waTemplates = ref<WhatsAppTemplate[]>([]);
const models = ref<string[]>([]);
const providers = ref<ModelProvider[]>([]);
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
  // The same for the WhatsApp templates: a tenant without that channel simply has none to choose.
  waTemplates.value = (await props.loadTemplates?.().catch(() => [])) ?? [];
  // Without the list the steps simply use the model of the plan.
  const offer = await props.client.models().catch(() => ({ items: [], providers: [] }));
  models.value = offer.items;
  providers.value = offer.providers;
}
onMounted(load);

// The plan can change from elsewhere (Ignis enables the module while this page is open).
refreshOnFocus(load, 5_000);

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

// --- trying a failed run again ----------------------------------------------------------------
const retrying = ref<string | null>(null);

async function retry(run: AutomationRun) {
  retrying.value = run.id;
  try {
    await props.client.retryRun(run.id);
    $q.notify({ type: 'positive', message: t('tenant.automations.retried') });
    await loadRuns();
  } catch (e) {
    const detail = (e as { detail?: string }).detail;
    $q.notify({
      type: 'negative',
      message: detail
        ? t('tenant.automations.retryRefusedWith', { why: detail })
        : t('tenant.automations.retryRefused'),
    });
  } finally {
    retrying.value = null;
  }
}

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

// A template makes a rule the owner still sees in the builder and can change before saving it.
const galleryOpen = ref(false);
function fromTemplate(rule: AutomationRule) {
  galleryOpen.value = false;
  draft.value = ruleToDraft(rule);
  apiError.value = '';
  building.value = true;
}

const notIncludedText = (ai: boolean) =>
  props.operator
    ? t(ai ? 'admin.tenant.automationsOff.ai' : 'admin.tenant.automationsOff.plain')
    : `${t(ai ? 'tenant.automations.notIncludedAi' : 'tenant.automations.notIncluded')} ${t('common.managedByIgnis')}`;

function refusal(e: unknown, input: AutomationInput): string {
  const code = codeOf(e);
  if (code === 'module_not_included') {
    return notIncludedText(usesAI(input));
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
        <div v-if="section !== 'runs'" class="row q-gutter-sm">
          <IgButton
            variant="secondary"
            icon="auto_stories"
            :label="t('tenant.automations.templates.open')"
            @click="galleryOpen = true"
          />
          <IgButton
            variant="primary"
            icon="add"
            :label="t('tenant.automations.new')"
            @click="start()"
          />
        </div>
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
      {{ notIncludedText(false) }}
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
                  <template v-if="run.status === 'running' && run.resume_at">
                    · {{ t('tenant.automations.waitingUntil', { at: when(run.resume_at) }) }}
                  </template>
                </div>
              </div>
              <span class="ig-pill" :class="statusClass(run.status)">
                {{
                  run.status === 'running' && run.resume_at
                    ? t('tenant.automations.status.waiting')
                    : t(`tenant.automations.status.${run.status}`)
                }}
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
              <div v-if="run.status === 'failed'" class="q-mt-sm">
                <IgButton
                  variant="secondary"
                  size="sm"
                  icon="replay"
                  :label="t('tenant.automations.retry')"
                  :loading="retrying === run.id"
                  @click.stop="retry(run)"
                />
                <span class="text-caption ig-muted q-ml-sm">{{
                  t('tenant.automations.retryHint')
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>

    <AutomationTemplates v-model="galleryOpen" :client="client" @build="fromTemplate" />

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
          :templates="waTemplates"
          :models="models"
          :providers="providers"
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
