<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  AutomationActionType,
  AutomationInput,
  AutomationSampleEvent,
  AutomationTrace,
} from '@/api/automations';
import type { Connector } from '@/api/tenant';
import AutomationTest from '@/components/AutomationTest.vue';
import ConditionRows from '@/components/ConditionRows.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import StepEditor from '@/components/StepEditor.vue';
import {
  draftToInput,
  emptyCondition,
  emptyStep,
  TIME_ZONES,
  usesAI,
  type RuleDraft,
} from '@/utils/automations';

const props = defineProps<{
  connectors: Connector[];
  saving: boolean;
  /** Why the API refused the rule, when it did. */
  apiError: string;
  test: (rule: AutomationInput, event: AutomationSampleEvent) => Promise<AutomationTrace>;
}>();
const draft = defineModel<RuleDraft>({ required: true });
const emit = defineEmits<{ save: [input: AutomationInput]; cancel: [] }>();
const { t } = useI18n();

const FIXED: AutomationActionType[] = [
  'reply',
  'email_business',
  'connector_call',
  'handoff',
  'ignis_stats',
];
const WITH_AI: AutomationActionType[] = ['ai_analyze', 'ai_extract'];
const DAYS = [1, 2, 3, 4, 5, 6, 7];

const hasAI = computed(() => usesAI({ actions: draft.value.steps.map((s) => ({ type: s.type })) }));
const onSchedule = computed(() => draft.value.trigger === 'schedule');

function setTrigger(v: RuleDraft['trigger']) {
  draft.value.trigger = v;
  // Everything about a conversation goes with the message that started it.
  if (v === 'schedule') {
    draft.value.steps = draft.value.steps.filter((s) => s.type !== 'reply' && s.type !== 'handoff');
    draft.value.conditions = draft.value.conditions.filter(
      (c) => c.field.startsWith('time.') || c.field.startsWith('vars.'),
    );
    draft.value.cooldown = '';
  } else if (!draft.value.conditions.length) {
    draft.value.conditions = [emptyCondition('message_received')];
  }
}

function addStep(type: AutomationActionType) {
  draft.value.steps.push(emptyStep(type));
}
function removeStep(i: number) {
  draft.value.steps.splice(i, 1);
}
function move(i: number, by: -1 | 1) {
  const steps = draft.value.steps;
  const j = i + by;
  const a = steps[i];
  const b = steps[j];
  if (!a || !b) return;
  steps[i] = b;
  steps[j] = a;
}
const blocked = (type: AutomationActionType) =>
  onSchedule.value && (type === 'reply' || type === 'handoff');

// --- validation shown where the mistake is -----------------------------------------------------
const errorText = (code: string, detail?: string) =>
  t(`tenant.automations.errors.${code}`) + (detail ? ` (${detail})` : '');

interface Problems {
  top: string;
  step: Record<number, string>;
}

function check(): { input?: AutomationInput; problems: Problems } {
  const r = draftToInput(draft.value);
  if (r.ok) {
    const input = { ...r.input };
    if (draft.value.trigger === 'message_received' && draft.value.timezone !== 'America/Bogota') {
      input.timezone = draft.value.timezone;
    }
    return { input, problems: { top: '', step: {} } };
  }
  const text = errorText(r.error, r.detail);
  return r.step === undefined
    ? { problems: { top: text, step: {} } }
    : { problems: { top: '', step: { [r.step]: text } } };
}

/** The mistakes are shown after the first try to save, and then follow what is typed. */
const attempted = ref(false);
const problems = computed(() => (attempted.value ? check().problems : { top: '', step: {} }));

function save() {
  attempted.value = true;
  const { input } = check();
  if (input) emit('save', input);
}

function buildForTest(): { input?: AutomationInput; error?: string } {
  const { input, problems: p } = check();
  return input ? { input } : { error: p.top || Object.values(p.step)[0] || '' };
}
</script>

<template>
  <div class="column no-wrap" style="min-height: 0; height: 100%">
    <div class="col" style="overflow-y: auto; min-height: 0">
      <div class="q-pa-md q-gutter-y-md">
        <IgAlert v-if="problems.top" tone="error">{{ problems.top }}</IgAlert>
        <IgAlert v-if="apiError" tone="error">{{ apiError }}</IgAlert>

        <!-- Name -->
        <div class="row q-col-gutter-md items-center">
          <div class="col-12 col-sm">
            <q-input
              v-model="draft.name"
              outlined
              maxlength="80"
              :label="t('tenant.automations.builder.name')"
              :hint="t('tenant.automations.builder.nameHint')"
            />
          </div>
          <div class="col-12 col-sm-auto">
            <q-toggle v-model="draft.enabled" :label="t('tenant.automations.builder.enabled')" />
          </div>
        </div>

        <!-- When -->
        <div class="ig-card q-pa-md">
          <div class="ig-section-title">{{ t('tenant.automations.builder.when') }}</div>
          <IgSegmented
            :model-value="draft.trigger"
            :label="t('tenant.automations.builder.when')"
            :options="[
              { value: 'message_received', label: t('tenant.automations.builder.onMessage') },
              { value: 'schedule', label: t('tenant.automations.builder.onSchedule') },
            ]"
            class="q-mt-sm"
            @update:model-value="setTrigger"
          />
          <div v-if="onSchedule" class="row q-col-gutter-md q-mt-xs">
            <div class="col-12 col-sm-4">
              <q-input
                v-model="draft.at"
                outlined
                dense
                type="time"
                :label="t('tenant.automations.builder.at')"
              />
            </div>
            <div class="col-12 col-sm-8">
              <q-select
                v-model="draft.timezone"
                outlined
                dense
                :options="[...TIME_ZONES]"
                :label="t('tenant.automations.builder.timezone')"
              />
            </div>
            <div class="col-12">
              <div class="text-caption ig-muted q-mb-xs">
                {{ t('tenant.automations.builder.weekdays') }}
              </div>
              <div class="row q-gutter-xs">
                <q-checkbox
                  v-for="d in DAYS"
                  :key="d"
                  v-model="draft.weekdays"
                  :val="d"
                  dense
                  :label="t(`tenant.automations.day.${d}`)"
                  class="q-mr-sm"
                />
              </div>
              <div class="text-caption ig-muted">
                {{ t('tenant.automations.builder.weekdaysHint') }}
              </div>
            </div>
          </div>
        </div>

        <!-- Conditions -->
        <div class="ig-card q-pa-md">
          <div class="ig-section-title">{{ t('tenant.automations.builder.conditions') }}</div>
          <div class="text-caption ig-muted q-mb-sm">
            {{ t('tenant.automations.builder.conditionsHint') }}
          </div>
          <q-option-group
            v-if="draft.conditions.length > 1"
            v-model="draft.match"
            inline
            class="q-mb-sm"
            :options="[
              { value: 'all', label: t('tenant.automations.matchAll') },
              { value: 'any', label: t('tenant.automations.matchAny') },
            ]"
          />
          <ConditionRows v-model="draft.conditions" :trigger="draft.trigger" />
          <div v-if="!draft.conditions.length" class="text-caption ig-muted q-mt-xs">
            {{ t('tenant.automations.builder.noConditions') }}
          </div>
        </div>

        <!-- Steps -->
        <div>
          <div class="ig-section-title">{{ t('tenant.automations.builder.steps') }}</div>
          <div class="text-caption ig-muted q-mb-sm">
            {{ t('tenant.automations.builder.stepsHint') }}
          </div>
          <div class="column q-gutter-y-sm">
            <StepEditor
              v-for="(s, i) in draft.steps"
              :key="s.key"
              :step="s"
              :index="i"
              :steps="draft.steps"
              :trigger="draft.trigger"
              :connectors="connectors"
              :problem="problems.step[i]"
              :first="i === 0"
              :last="i === draft.steps.length - 1"
              @remove="removeStep(i)"
              @up="move(i, -1)"
              @down="move(i, 1)"
            />
          </div>

          <div class="q-mt-md">
            <div class="ig-eyebrow q-mb-xs">{{ t('tenant.automations.builder.addFixed') }}</div>
            <div class="row q-gutter-sm">
              <IgButton
                v-for="type in FIXED"
                :key="type"
                variant="secondary"
                size="sm"
                icon="add"
                :disable="blocked(type)"
                :label="t(`tenant.automations.step.${type}.name`)"
                @click="addStep(type)"
              />
            </div>
            <div class="ig-eyebrow q-mt-md q-mb-xs">
              {{ t('tenant.automations.builder.addAi') }}
            </div>
            <div class="row q-gutter-sm">
              <IgButton
                v-for="type in WITH_AI"
                :key="type"
                variant="secondary"
                size="sm"
                icon="auto_awesome"
                :label="t(`tenant.automations.step.${type}.name`)"
                @click="addStep(type)"
              />
            </div>
            <div class="text-caption ig-muted q-mt-xs">
              {{ t('tenant.automations.builder.aiCost') }}
            </div>
          </div>
        </div>

        <!-- Options -->
        <q-expansion-item
          :label="t('tenant.automations.builder.options')"
          class="ig-card"
          header-class="text-weight-bold"
        >
          <div class="q-pa-md q-gutter-y-md">
            <q-input
              v-if="!onSchedule"
              v-model="draft.cooldown"
              outlined
              dense
              inputmode="numeric"
              :label="t('tenant.automations.builder.cooldown')"
              :hint="t('tenant.automations.builder.cooldownHint')"
            />
            <q-select
              v-if="!onSchedule"
              v-model="draft.timezone"
              outlined
              dense
              :options="[...TIME_ZONES]"
              :label="t('tenant.automations.builder.messageZone')"
              :hint="t('tenant.automations.builder.messageZoneHint')"
            />
            <q-input
              v-if="hasAI"
              v-model="draft.budget"
              outlined
              dense
              inputmode="decimal"
              :label="t('tenant.automations.builder.budget')"
              :hint="t('tenant.automations.builder.budgetHint')"
            />
          </div>
        </q-expansion-item>

        <!-- Test -->
        <q-expansion-item
          :label="t('tenant.automations.builder.test')"
          icon="science"
          class="ig-card"
          header-class="text-weight-bold"
        >
          <div class="q-pa-md">
            <AutomationTest :build="buildForTest" :trigger="draft.trigger" :test="props.test" />
          </div>
        </q-expansion-item>
      </div>
    </div>

    <div
      class="row justify-end q-pa-md q-gutter-x-sm"
      style="border-top: 1px solid var(--ig-border)"
    >
      <IgButton
        variant="ghost"
        :disable="saving"
        :label="t('common.cancel')"
        @click="emit('cancel')"
      />
      <IgButton
        variant="primary"
        :loading="saving"
        :label="t('tenant.automations.builder.save')"
        @click="save"
      />
    </div>
  </div>
</template>
