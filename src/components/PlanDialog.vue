<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ApiError } from '@/api/http';
import type { Catalog, LimitDef, Plan } from '@/api/ops';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import { useCatalogName } from '@/composables/catalogName';
import { useSessionStore } from '@/stores/session';
import {
  ALLOWANCE_KEY,
  formOf,
  inputOf,
  planIdFrom,
  planProblems,
  type PlanForm,
} from '@/utils/plans';

const props = defineProps<{ plan?: Plan | undefined; catalog: Catalog }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ saved: [plan: Plan] }>();

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();
const nameOf = useCatalogName();

const creating = computed(() => !props.plan);
const form = ref<PlanForm>(formOf());
const idTouched = ref(false);
const saving = ref(false);
const error = ref('');
const tried = ref(false);

watch(open, (v) => {
  if (!v) return;
  form.value = formOf(props.plan);
  idTouched.value = false;
  error.value = '';
  tried.value = false;
});

function onName(v: string | number | null) {
  form.value.name = String(v ?? '');
  if (creating.value && !idTouched.value) form.value.id = planIdFrom(form.value.name);
}

const problems = computed(() => planProblems(form.value, creating.value));
const bad = (p: (typeof problems.value)[number]) => tried.value && problems.value.includes(p);

// The limits of the modules the plan has, plus the ones every client has; the AI credit has its own field.
const limitDefs = computed<LimitDef[]>(() => {
  const own = props.catalog.modules
    .filter((m) => form.value.modules.includes(m.id))
    .flatMap((m) => m.limits);
  return [...props.catalog.core_limits, ...own].filter((d) => d.key !== ALLOWANCE_KEY);
});

const limitValue = (d: LimitDef) => form.value.limits[d.key] ?? d.default;

function setLimit(d: LimitDef, v: string | number | null) {
  const n = Number(v);
  if (v === null || v === '' || !Number.isInteger(n) || n < -1) return;
  form.value.limits[d.key] = n;
}

const unitText = (d: LimitDef) => {
  if (d.unit <= 1) return '';
  const mb = d.unit / (1024 * 1024);
  return mb >= 1 ? `× ${mb} MB` : `× ${d.unit / 1024} KB`;
};

async function save() {
  tried.value = true;
  const body = inputOf(form.value, creating.value);
  if (!body) return;
  // A limit of a module the plan no longer has does not travel with it.
  const known = new Set([ALLOWANCE_KEY, ...limitDefs.value.map((d) => d.key)]);
  body.limits = Object.fromEntries(Object.entries(body.limits).filter(([k]) => known.has(k)));
  saving.value = true;
  error.value = '';
  try {
    const saved = props.plan
      ? await session.ops.replacePlan(props.plan.id, body)
      : await session.ops.createPlan(body);
    open.value = false;
    $q.notify({
      type: 'positive',
      message: creating.value ? t('admin.plans.created') : t('admin.plans.saved'),
    });
    emit('saved', saved);
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 409
        ? t('admin.plans.conflict')
        : e instanceof ApiError && e.status === 400
          ? e.detail || t('admin.plans.invalid')
          : t('common.loadError');
  } finally {
    saving.value = false;
  }
}

const kinds = computed(() => [
  { value: 'standard' as const, label: t('admin.plans.kind.standard') },
  { value: 'custom' as const, label: t('admin.plans.kind.custom') },
]);
</script>

<template>
  <q-dialog v-model="open" :persistent="saving">
    <q-card
      class="ig-card ig-card--raised"
      style="width: 720px; max-width: 96vw; border-radius: 20px"
    >
      <q-form autocomplete="off" @submit.prevent="save">
        <q-card-section>
          <div class="text-h6">
            {{ creating ? t('admin.plans.new') : t('admin.plans.edit', { name: plan?.name }) }}
          </div>
          <div v-if="!creating && plan?.tenants" class="text-caption ig-muted q-mt-xs">
            {{ t('admin.plans.editWarning', { n: plan.tenants }) }}
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-y-md" style="max-height: 70vh; overflow-y: auto">
          <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>

          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-7">
              <q-input
                :model-value="form.name"
                outlined
                autofocus
                maxlength="80"
                :label="t('admin.plans.name')"
                :error="bad('name')"
                :error-message="t('admin.plans.errors.name')"
                @update:model-value="onName"
              />
            </div>
            <div class="col-12 col-sm-5">
              <q-input
                v-model="form.id"
                outlined
                :disable="!creating"
                :label="t('admin.plans.id')"
                :hint="creating ? t('admin.plans.idHint') : undefined"
                :error="bad('id')"
                :error-message="t('admin.plans.errors.id')"
                input-class="ig-code"
                @update:model-value="idTouched = true"
              />
            </div>
          </div>

          <q-input
            v-model="form.description"
            outlined
            type="textarea"
            autogrow
            maxlength="400"
            counter
            :label="t('admin.plans.description')"
            :hint="t('admin.plans.descriptionHint')"
          />

          <div>
            <div class="ig-eyebrow q-mb-xs">{{ t('admin.plans.kindLabel') }}</div>
            <IgSegmented v-model="form.kind" :options="kinds" :label="t('admin.plans.kindLabel')" />
            <div class="text-caption ig-muted q-mt-xs">
              {{ t(`admin.plans.kindHint.${form.kind}`) }}
            </div>
          </div>

          <div class="row q-col-gutter-md">
            <div class="col-8 col-sm-6">
              <q-input
                v-model="form.price"
                outlined
                inputmode="decimal"
                :label="t('admin.plans.price')"
                :hint="t('admin.plans.priceHint')"
                :error="bad('price')"
                :error-message="t('admin.plans.errors.price')"
              />
            </div>
            <div class="col-4 col-sm-2">
              <q-input
                v-model="form.currency"
                outlined
                maxlength="3"
                :label="t('admin.plans.currency')"
                :error="bad('currency')"
                :error-message="t('admin.plans.errors.currency')"
                input-class="ig-code"
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                v-model="form.credit"
                outlined
                inputmode="decimal"
                prefix="USD"
                :label="t('admin.plans.credit')"
                :error="bad('credit')"
                :error-message="t('admin.plans.errors.credit')"
              />
            </div>
          </div>
          <div class="text-caption ig-muted" style="margin-top: -8px">
            {{ t('admin.plans.creditHint') }}
          </div>

          <div>
            <div class="ig-section-title">{{ t('admin.plans.modules') }}</div>
            <div class="text-caption ig-muted q-mb-sm">{{ t('admin.plans.modulesHint') }}</div>
            <div class="row q-col-gutter-sm">
              <div v-for="m in catalog.modules" :key="m.id" class="col-12 col-sm-6">
                <q-checkbox
                  v-model="form.modules"
                  :val="m.id"
                  color="primary"
                  :label="nameOf('modules', m.id)"
                />
                <div class="text-caption ig-muted q-ml-xl">{{ m.description }}</div>
              </div>
            </div>
          </div>

          <div>
            <div class="ig-section-title">{{ t('admin.plans.limits') }}</div>
            <div class="text-caption ig-muted q-mb-md">{{ t('admin.plans.limitsHint') }}</div>
            <div
              v-for="d in limitDefs"
              :key="d.key"
              class="row items-center q-col-gutter-sm q-mb-sm"
            >
              <div class="col-12 col-sm-7">
                <div class="text-weight-medium">{{ nameOf('limits', d.key) }}</div>
                <div class="text-caption ig-muted">{{ d.description }}</div>
              </div>
              <div class="col-12 col-sm-5">
                <q-input
                  :model-value="limitValue(d)"
                  type="number"
                  outlined
                  dense
                  :suffix="unitText(d)"
                  :hint="limitValue(d) === -1 ? t('admin.plans.unlimited') : undefined"
                  @update:model-value="setLimit(d, $event)"
                />
              </div>
            </div>
          </div>

          <div>
            <q-toggle v-model="form.active" color="primary" :label="t('admin.plans.active')" />
            <div class="text-caption ig-muted">{{ t('admin.plans.activeHint') }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <IgButton
            variant="ghost"
            :disable="saving"
            :label="t('common.cancel')"
            @click="open = false"
          />
          <IgButton
            variant="primary"
            type="submit"
            :loading="saving"
            :label="creating ? t('admin.plans.create') : t('admin.plans.save')"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
