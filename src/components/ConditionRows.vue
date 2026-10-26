<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import IgButton from '@/components/IgButton.vue';
import {
  emptyCondition,
  fieldKind,
  LIST_OPS,
  MESSAGE_FIELDS,
  opsFor,
  TIME_FIELDS,
  type ConditionDraft,
  type RuleDraft,
} from '@/utils/automations';

const props = defineProps<{
  trigger: RuleDraft['trigger'];
  /** The variables of earlier steps a condition may read, such as `vars.c.urgencia`. */
  vars?: string[];
  /** The conditions of a step may read variables; those of the rule may not. */
  allowVars?: boolean;
}>();
const model = defineModel<ConditionDraft[]>({ required: true });
const { t } = useI18n();

const fieldLabel = (f: string) =>
  f.startsWith('vars.') ? f : t(`tenant.automations.field.${f.replace('.', '_')}`);

const fields = computed(() => {
  const out: string[] = [];
  if (props.trigger === 'message_received') out.push(...MESSAGE_FIELDS);
  out.push(...TIME_FIELDS);
  if (props.allowVars) out.push(...(props.vars ?? []));
  return out.map((f) => ({ value: f, label: fieldLabel(f) }));
});

function setField(c: ConditionDraft, field: string) {
  c.field = field;
  // Keep the comparison if it still makes sense for the new field.
  if (!opsFor(field).includes(c.op)) c.op = opsFor(field)[0] ?? 'equals';
}

/** A variable of a system is typed by hand, as `vars.nombre.campo`. */
function addField(value: string, done: (v: string) => void) {
  const v = value.trim();
  done(/^vars\.[a-z][a-z0-9_]{0,23}(\.[A-Za-z0-9_-]+)*$/.test(v) ? v : '');
}

function add() {
  model.value = [...model.value, emptyCondition(props.trigger)];
}
function remove(i: number) {
  model.value = model.value.filter((_, j) => j !== i);
}

const isList = (c: ConditionDraft) => LIST_OPS.includes(c.op);
</script>

<template>
  <div class="column q-gutter-y-sm">
    <div v-for="(c, i) in model" :key="i" class="row q-col-gutter-sm items-start no-wrap-md">
      <div class="col-12 col-md-4">
        <q-select
          :model-value="c.field"
          dense
          outlined
          emit-value
          map-options
          :use-input="allowVars"
          :new-value-mode="allowVars ? 'add-unique' : undefined"
          :options="fields"
          :label="t('tenant.automations.condition.field')"
          @update:model-value="(v: string) => setField(c, v)"
          @new-value="addField"
        />
      </div>
      <div class="col-12 col-sm-5 col-md-3">
        <q-select
          v-model="c.op"
          dense
          outlined
          emit-value
          map-options
          :options="
            opsFor(c.field).map((o) => ({ value: o, label: t(`tenant.automations.op.${o}`) }))
          "
          :label="t('tenant.automations.condition.op')"
        />
      </div>
      <div class="col-12 col-sm col-md">
        <template v-if="c.op !== 'exists'">
          <q-toggle
            v-if="fieldKind(c.field) === 'flag'"
            v-model="c.flag"
            :label="
              c.flag ? t('tenant.automations.condition.yes') : t('tenant.automations.condition.no')
            "
          />
          <q-input
            v-else
            v-model="c.text"
            dense
            outlined
            :inputmode="fieldKind(c.field) === 'number' ? 'decimal' : 'text'"
            :label="
              isList(c)
                ? t('tenant.automations.condition.list')
                : t('tenant.automations.condition.value')
            "
            :hint="isList(c) ? t('tenant.automations.condition.listHint') : undefined"
          />
        </template>
      </div>
      <div class="col-auto">
        <IgButton
          variant="ghost"
          size="sm"
          icon-only
          icon="close"
          :label="t('tenant.automations.condition.remove')"
          @click="remove(i)"
        />
      </div>
    </div>
    <div>
      <IgButton
        variant="secondary"
        size="sm"
        icon="add"
        :label="t('tenant.automations.condition.add')"
        @click="add"
      />
    </div>
  </div>
</template>
