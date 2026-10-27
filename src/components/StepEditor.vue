<script setup lang="ts">
import ModelPicker from '@/components/ModelPicker.vue';
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ModelProvider } from '@/api/automations';
import type { Connector } from '@/api/tenant';
import type { WhatsAppTemplate } from '@/api/whatsapp';
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
import { preview, variablesOf } from '@/utils/whatsapp';
import { WAIT_UNITS, type WaitUnit } from '@/utils/automations';

const props = defineProps<{
  index: number;
  steps: StepDraft[];
  trigger: RuleDraft['trigger'];
  connectors: Connector[];
  templates: WhatsAppTemplate[];
  models: string[];
  providers: ModelProvider[];
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
  knowledge_search: 'menu_book',
  whatsapp_template: 'chat',
  wait: 'schedule',
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

// --- WhatsApp template ------------------------------------------------------------------------
const template = computed(() => props.templates.find((x) => x.id === step.value.template));
const templateOptions = computed(() =>
  props.templates.map((x) => ({
    value: x.id,
    label: `${x.name} (${x.language}) · ${t(`whatsapp.status.${x.status}`)}`,
  })),
);
// One value for each variable of the template, kept as the choice changes.
function pickTemplate(id: string) {
  step.value.template = id;
  const n = variablesOf(props.templates.find((x) => x.id === id)?.body ?? '').length;
  step.value.values = Array.from({ length: n }, (_, i) => step.value.values[i] ?? '');
}
const writesToContact = computed(
  () => step.value.to.trim() === '' && props.trigger === 'message_received',
);
const withValues = computed(() =>
  template.value ? preview(template.value.body, step.value.values) : '',
);
const units = (['minutes', 'hours', 'days'] as WaitUnit[]).map((u) => ({
  value: u,
  label: u,
}));
const waitMinutes = computed(() => {
  const n = Number(step.value.amount.replace(',', '.'));
  return Number.isFinite(n) ? n * WAIT_UNITS[step.value.unit] : NaN;
});

// --- model steps --------------------------------------------------------------------------------
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

      <!-- knowledge -->
      <template v-else-if="step.type === 'knowledge_search'">
        <q-input
          v-model="step.query"
          dense
          outlined
          maxlength="500"
          :label="t('tenant.automations.knowledgeQuery')"
          :hint="t('tenant.automations.knowledgeQueryHint')"
        />
        <div class="row q-col-gutter-sm q-mt-xs">
          <div class="col-12 col-sm-7">
            <q-input
              v-model="step.as"
              dense
              outlined
              maxlength="24"
              :label="t('tenant.automations.saveAs')"
              :hint="t('tenant.automations.knowledgeSaveAsHint')"
            />
          </div>
          <div class="col-12 col-sm-5">
            <q-input
              v-model="step.limit"
              dense
              outlined
              inputmode="numeric"
              :label="t('tenant.automations.knowledgeLimit')"
              :hint="t('tenant.automations.knowledgeLimitHint')"
            />
          </div>
        </div>
      </template>

      <!-- WhatsApp template -->
      <template v-else-if="step.type === 'whatsapp_template'">
        <q-select
          :model-value="step.template"
          dense
          outlined
          emit-value
          map-options
          :options="templateOptions"
          :label="t('tenant.automations.waTemplate')"
          :hint="
            templateOptions.length
              ? t('tenant.automations.waTemplateHint')
              : t('tenant.automations.waNoTemplates')
          "
          @update:model-value="pickTemplate"
        />
        <q-input
          v-model="step.to"
          dense
          outlined
          inputmode="numeric"
          class="q-mt-sm"
          :label="t('tenant.automations.waTo')"
          :hint="
            trigger === 'message_received'
              ? t('tenant.automations.waToHintMessage')
              : t('tenant.automations.waToHintSchedule')
          "
        />
        <div v-if="template && step.values.length" class="column q-gutter-y-sm q-mt-sm">
          <div class="text-caption ig-muted">{{ t('tenant.automations.waValues') }}</div>
          <q-input
            v-for="(_, i) in step.values"
            :key="i"
            v-model="step.values[i]"
            dense
            outlined
            :label="t('tenant.automations.waValueOf', { n: i + 1 })"
          />
        </div>
        <div v-if="template" class="ig-wa-preview q-mt-sm">{{ withValues }}</div>
        <div v-if="writesToContact" class="text-caption ig-muted q-mt-xs">
          {{ t('tenant.automations.waToContact') }}
        </div>
      </template>

      <!-- wait -->
      <template v-else-if="step.type === 'wait'">
        <div class="row q-col-gutter-sm">
          <div class="col-6 col-sm-4">
            <q-input
              v-model="step.amount"
              dense
              outlined
              inputmode="numeric"
              :label="t('tenant.automations.waAmount')"
            />
          </div>
          <div class="col-6 col-sm-5">
            <q-select
              v-model="step.unit"
              dense
              outlined
              emit-value
              map-options
              :options="
                units.map((u) => ({
                  value: u.value,
                  label: t(`tenant.automations.waUnit.${u.value}`),
                }))
              "
              :label="t('tenant.automations.waUnitLabel')"
            />
          </div>
        </div>
        <div class="text-caption ig-muted q-mt-xs">
          {{
            t('tenant.automations.waitHint', {
              minutes: Number.isFinite(waitMinutes) ? waitMinutes : 0,
            })
          }}
        </div>
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

        <ModelPicker
          v-if="models.length || step.model"
          v-model="step.model"
          class="q-mt-xs"
          :models="models"
          :providers="providers"
          :default-label="t('tenant.automations.modelDefault')"
        />
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
.ig-wa-preview {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--ig-surface-2, rgba(127, 127, 127, 0.1));
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  line-height: 1.45;
}
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
