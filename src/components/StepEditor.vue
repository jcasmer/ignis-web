<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Connector } from '@/api/tenant';
import ConditionRows from '@/components/ConditionRows.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import {
  extractedFields,
  isAIAction,
  varsBefore,
  type RuleDraft,
  type SchemaType,
  type StepDraft,
} from '@/utils/automations';
import { effectiveRisk } from '@/utils/connectors';

const props = defineProps<{
  index: number;
  steps: StepDraft[];
  trigger: RuleDraft['trigger'];
  connectors: Connector[];
  /** What is wrong with this step, from the validation of the form. */
  problem?: string | undefined;
  first: boolean;
  last: boolean;
}>();
/** The step the editor changes. It is a model, not a prop: the form edits it in place. */
const step = defineModel<StepDraft>('step', { required: true });
const emit = defineEmits<{ remove: []; up: []; down: [] }>();
const { t } = useI18n();

const ICONS: Record<StepDraft['type'], string> = {
  reply: 'chat_bubble_outline',
  email_business: 'mail_outline',
  connector_call: 'hub',
  handoff: 'support_agent',
  ai_analyze: 'auto_awesome',
  ai_extract: 'data_object',
  ignis_stats: 'insights',
};

const icon = computed(() => ICONS[step.value.type]);
const ai = computed(() => isAIAction(step.value.type));

// --- what the texts of this step can use ---------------------------------------------------
const available = computed(() => {
  const out: string[] = [];
  if (props.trigger === 'message_received') {
    out.push('message.text', 'message.channel', 'contact.name');
  }
  out.push('time.date', 'time.time');
  out.push(...varsBefore(props.steps, props.index).map((v) => `vars.${v}`));
  return out.map((f) => `{{${f}}}`).join('  ');
});

const guardVars = computed(() => [
  ...varsBefore(props.steps, props.index).map((v) => `vars.${v}`),
  ...extractedFields(props.steps, props.index),
]);

// --- connector call --------------------------------------------------------------------------
const connector = computed(() => props.connectors.find((c) => c.name === step.value.connector));
const operation = computed(() =>
  connector.value?.operations.find((o) => o.name === step.value.operation),
);
const params = computed(() => {
  const schema = operation.value?.params as
    | { properties?: Record<string, { type?: string; description?: string }>; required?: string[] }
    | undefined;
  return Object.entries(schema?.properties ?? {}).map(([name, p]) => ({
    name,
    type: p.type ?? 'string',
    description: p.description ?? '',
    required: !!schema?.required?.includes(name),
  }));
});

function pickConnector(name: string) {
  step.value.connector = name;
  step.value.operation = '';
  step.value.args = {};
  step.value.argTypes = {};
}

function pickOperation(name: string) {
  step.value.operation = name;
  const op = connector.value?.operations.find((o) => o.name === name);
  const schema = op?.params as { properties?: Record<string, { type?: string }> } | undefined;
  const args: Record<string, string> = {};
  const types: Record<string, string> = {};
  for (const [arg, p] of Object.entries(schema?.properties ?? {})) {
    args[arg] = step.value.args[arg] ?? '';
    types[arg] = p.type ?? 'string';
  }
  step.value.args = args;
  step.value.argTypes = types;
}

// A connector that changed under the rule keeps what was typed for the arguments it still has.
watch(
  () => props.connectors,
  () => {
    if (step.value.type === 'connector_call' && step.value.operation && !operation.value) {
      step.value.argTypes = { ...step.value.argTypes };
    }
  },
);

// --- model steps -------------------------------------------------------------------------------
function addInput() {
  step.value.inputs.push({ label: '', value: '' });
}
function removeInput(i: number) {
  step.value.inputs.splice(i, 1);
}
function addField() {
  step.value.fields.push({ name: '', type: 'string', values: '', required: true });
}
function removeField(i: number) {
  step.value.fields.splice(i, 1);
}
const SCHEMA_TYPES: SchemaType[] = ['string', 'number', 'integer', 'boolean'];

const DAYS = [1, 3, 7, 14, 30, 60, 90];
</script>

<template>
  <div class="ig-card q-pa-md" :class="{ 'ig-card--problem': problem }">
    <div class="row items-center q-mb-sm no-wrap">
      <span class="ig-step__n">{{ index + 1 }}</span>
      <q-icon :name="icon" size="20px" class="q-mr-sm" />
      <div class="col">
        <div class="text-weight-bold">{{ t(`tenant.automations.step.${step.type}.name`) }}</div>
        <div class="text-caption ig-muted">
          {{ t(`tenant.automations.step.${step.type}.hint`) }}
        </div>
      </div>
      <span v-if="ai" class="ig-pill ig-pill--brand q-mr-sm">{{
        t('tenant.automations.aiBadge')
      }}</span>
      <IgButton
        variant="ghost"
        size="sm"
        icon-only
        icon="arrow_upward"
        :disable="first"
        :label="t('tenant.automations.moveUp')"
        @click="emit('up')"
      />
      <IgButton
        variant="ghost"
        size="sm"
        icon-only
        icon="arrow_downward"
        :disable="last"
        :label="t('tenant.automations.moveDown')"
        @click="emit('down')"
      />
      <IgButton
        variant="ghost"
        size="sm"
        icon-only
        icon="delete_outline"
        :label="t('tenant.automations.removeStep')"
        @click="emit('remove')"
      />
    </div>

    <IgAlert v-if="problem" tone="error" class="q-mb-sm">{{ problem }}</IgAlert>

    <div class="column q-gutter-y-sm">
      <!-- reply -->
      <template v-if="step.type === 'reply'">
        <q-input
          v-model="step.text"
          outlined
          type="textarea"
          autogrow
          maxlength="1000"
          :label="t('tenant.automations.replyText')"
        />
      </template>

      <!-- email -->
      <template v-else-if="step.type === 'email_business'">
        <q-input
          v-model="step.subject"
          outlined
          dense
          maxlength="150"
          :label="t('tenant.automations.subject')"
        />
        <q-input
          v-model="step.body"
          outlined
          type="textarea"
          autogrow
          maxlength="4000"
          :label="t('tenant.automations.body')"
        />
      </template>

      <!-- call a system -->
      <template v-else-if="step.type === 'connector_call'">
        <IgAlert v-if="!connectors.length" tone="warn">{{
          t('tenant.automations.noConnectors')
        }}</IgAlert>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-5">
            <q-select
              :model-value="step.connector"
              dense
              outlined
              emit-value
              map-options
              :options="connectors.map((c) => ({ value: c.name, label: c.name }))"
              :label="t('tenant.automations.connector')"
              @update:model-value="pickConnector"
            />
          </div>
          <div class="col-12 col-sm-7">
            <q-select
              :model-value="step.operation"
              dense
              outlined
              emit-value
              map-options
              :disable="!connector"
              :options="
                (connector?.operations ?? []).map((o) => ({
                  value: o.name,
                  label: `${o.name} · ${t(`tenant.automations.risk.${effectiveRisk(o)}`)}`,
                }))
              "
              :label="t('tenant.automations.operation')"
              @update:model-value="pickOperation"
            />
          </div>
        </div>
        <div v-if="operation && effectiveRisk(operation) !== 'read'" class="text-caption ig-muted">
          {{ t('tenant.automations.writesNote') }}
        </div>
        <template v-if="params.length">
          <div class="ig-eyebrow">{{ t('tenant.automations.arguments') }}</div>
          <q-input
            v-for="p in params"
            :key="p.name"
            v-model="step.args[p.name]"
            dense
            outlined
            :label="`${p.name}${p.required ? ' *' : ''} (${p.type})`"
            :hint="p.description || undefined"
          />
        </template>
        <q-input
          v-model="step.as"
          dense
          outlined
          maxlength="24"
          :label="t('tenant.automations.saveAs')"
          :hint="t('tenant.automations.saveAsHint')"
        />
      </template>

      <!-- hand off -->
      <template v-else-if="step.type === 'handoff'">
        <q-input
          v-model="step.reason"
          outlined
          dense
          maxlength="300"
          :label="t('tenant.automations.handoffNote')"
          :hint="t('tenant.automations.handoffNoteHint')"
        />
      </template>

      <!-- activity -->
      <template v-else-if="step.type === 'ignis_stats'">
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-5">
            <q-select
              v-model="step.days"
              dense
              outlined
              emit-value
              map-options
              :options="
                DAYS.map((d) => ({
                  value: String(d),
                  label: t('tenant.automations.lastDays', { n: d }),
                }))
              "
              :label="t('tenant.automations.period')"
            />
          </div>
          <div class="col-12 col-sm-7">
            <q-input
              v-model="step.as"
              dense
              outlined
              maxlength="24"
              :label="t('tenant.automations.saveAs')"
              :hint="t('tenant.automations.statsHint')"
            />
          </div>
        </div>
      </template>

      <!-- model steps -->
      <template v-else>
        <q-input
          v-model="step.prompt"
          outlined
          type="textarea"
          autogrow
          maxlength="1500"
          :label="t('tenant.automations.prompt')"
          :hint="t('tenant.automations.promptHint')"
        />

        <div class="ig-eyebrow q-mt-sm">{{ t('tenant.automations.inputs') }}</div>
        <div class="text-caption ig-muted">{{ t('tenant.automations.inputsHint') }}</div>
        <div
          v-for="(inp, i) in step.inputs"
          :key="i"
          class="row q-col-gutter-sm items-start no-wrap-sm"
        >
          <div class="col-12 col-sm-4">
            <q-input
              v-model="inp.label"
              dense
              outlined
              maxlength="40"
              :label="t('tenant.automations.inputName')"
            />
          </div>
          <div class="col-12 col-sm">
            <q-input
              v-model="inp.value"
              dense
              outlined
              :label="t('tenant.automations.inputValue')"
            />
          </div>
          <div class="col-auto">
            <IgButton
              variant="ghost"
              size="sm"
              icon-only
              icon="close"
              :label="t('tenant.automations.removeInput')"
              @click="removeInput(i)"
            />
          </div>
        </div>
        <div>
          <IgButton
            variant="secondary"
            size="sm"
            icon="add"
            :label="t('tenant.automations.addInput')"
            @click="addInput"
          />
        </div>

        <template v-if="step.type === 'ai_extract'">
          <div class="ig-eyebrow q-mt-sm">{{ t('tenant.automations.extractWhat') }}</div>
          <div class="text-caption ig-muted">{{ t('tenant.automations.extractHint') }}</div>
          <div v-for="(f, i) in step.fields" :key="i" class="row q-col-gutter-sm items-center">
            <div class="col-12 col-sm-3">
              <q-input
                v-model="f.name"
                dense
                outlined
                maxlength="40"
                :label="t('tenant.automations.fieldName')"
              />
            </div>
            <div class="col-6 col-sm-2">
              <q-select
                v-model="f.type"
                dense
                outlined
                emit-value
                map-options
                :options="
                  SCHEMA_TYPES.map((s) => ({
                    value: s,
                    label: t(`tenant.automations.schemaType.${s}`),
                  }))
                "
                :label="t('tenant.automations.fieldType')"
              />
            </div>
            <div class="col-12 col-sm">
              <q-input
                v-if="f.type === 'string'"
                v-model="f.values"
                dense
                outlined
                :label="t('tenant.automations.fieldValues')"
                :hint="t('tenant.automations.fieldValuesHint')"
              />
            </div>
            <div class="col-auto">
              <q-checkbox
                v-model="f.required"
                dense
                :label="t('tenant.automations.fieldRequired')"
              />
            </div>
            <div class="col-auto">
              <IgButton
                variant="ghost"
                size="sm"
                icon-only
                icon="close"
                :label="t('tenant.automations.removeField')"
                @click="removeField(i)"
              />
            </div>
          </div>
          <div>
            <IgButton
              variant="secondary"
              size="sm"
              icon="add"
              :label="t('tenant.automations.addField')"
              @click="addField"
            />
          </div>
        </template>

        <div class="row q-col-gutter-sm q-mt-xs">
          <div class="col-12 col-sm-7">
            <q-input
              v-model="step.as"
              dense
              outlined
              maxlength="24"
              :label="t('tenant.automations.saveAs')"
              :hint="t('tenant.automations.aiSaveAsHint')"
            />
          </div>
          <div class="col-12 col-sm-5">
            <q-input
              v-model="step.maxTokens"
              dense
              outlined
              inputmode="numeric"
              :label="t('tenant.automations.maxTokens')"
              :hint="t('tenant.automations.maxTokensHint')"
            />
          </div>
        </div>
      </template>

      <div class="text-caption ig-muted">
        {{ t('tenant.automations.fieldsAvailable') }} <code>{{ available }}</code>
      </div>

      <!-- condition of the step -->
      <q-separator class="q-my-xs" />
      <q-toggle v-model="step.guard.enabled" :label="t('tenant.automations.guard.toggle')" />
      <template v-if="step.guard.enabled">
        <div class="text-caption ig-muted">
          {{
            step.type === 'reply'
              ? t('tenant.automations.guard.replyHint')
              : t('tenant.automations.guard.hint')
          }}
        </div>
        <q-option-group
          v-model="step.guard.match"
          inline
          :options="[
            { value: 'all', label: t('tenant.automations.matchAll') },
            { value: 'any', label: t('tenant.automations.matchAny') },
          ]"
        />
        <ConditionRows
          v-model="step.guard.conditions"
          :trigger="trigger"
          :vars="guardVars"
          :allow-vars="step.type !== 'reply'"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.ig-step__n {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: 10px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  background: var(--ig-surface-2);
}
.ig-card--problem {
  outline: 1px solid var(--ig-error);
}
code {
  font-size: 12px;
  word-break: break-all;
}
</style>
