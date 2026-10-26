<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Connector } from '@/api/tenant';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import OpenApiImport from '@/components/OpenApiImport.vue';
import { useSessionStore } from '@/stores/session';
import {
  AUTH_TYPES,
  draftFromConnector,
  effectiveRisk,
  emptyConnector,
  emptyOperation,
  hostOf,
  METHODS,
  RISKS,
  toConnectorInput,
  toolName,
  isDefaultBase,
  type ConnectorDraft,
  type OperationDraft,
} from '@/utils/connectors';
import { isUntouched } from '@/utils/openapi';

const props = defineProps<{ tenantId: string }>();

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const items = ref<Connector[]>([]);
const loading = ref(true);
const failed = ref(false);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    items.value = (await session.ops.connectors(props.tenantId)).items;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

// --- the editor --------------------------------------------------------------------
const editing = ref(false);
const saving = ref(false);
const error = ref('');
const draft = ref<ConnectorDraft>(emptyConnector());
/** The operation that is open in the editor. */
const openOp = ref(0);

function start(c?: Connector) {
  draft.value = c ? draftFromConnector(c) : emptyConnector();
  openOp.value = 0;
  error.value = '';
  editing.value = true;
}

function addOperation() {
  draft.value.operations.push(emptyOperation());
  openOp.value = draft.value.operations.length - 1;
}

// --- operations from an OpenAPI file ------------------------------------------------
const importing = ref(false);

function addImported(p: { baseUrl: string | null; operations: OperationDraft[] }) {
  const d = draft.value;
  // The empty operation the editor starts with makes room for the first imported one.
  if (d.operations.length === 1 && d.operations[0] && isUntouched(d.operations[0])) {
    d.operations = [];
  }
  const taken = new Set(d.operations.map((o) => o.name));
  for (const op of p.operations) {
    let name = op.name;
    for (let i = 2; taken.has(name); i++) {
      const suffix = `_${i}`;
      name = op.name.slice(0, 40 - suffix.length) + suffix;
    }
    taken.add(name);
    d.operations.push({ ...op, name });
  }
  if (p.baseUrl && isDefaultBase(d.baseUrl)) d.baseUrl = p.baseUrl;
  openOp.value = Math.max(0, d.operations.length - p.operations.length);
  $q.notify({
    type: 'positive',
    message: t('admin.tenant.connectors.import.added', { n: p.operations.length }),
  });
}

function removeOperation(i: number) {
  draft.value.operations.splice(i, 1);
  openOp.value = Math.max(0, Math.min(openOp.value, draft.value.operations.length - 1));
}

async function save() {
  error.value = '';
  const r = toConnectorInput(draft.value);
  if (!r.ok) {
    const where =
      r.op === undefined
        ? ''
        : t('admin.tenant.connectors.inOperation', {
            n: r.op + 1,
            name: draft.value.operations[r.op]?.name || '—',
          });
    error.value = `${t(`admin.tenant.connectors.errors.${r.error}`)}${where}`;
    if (r.op !== undefined) openOp.value = r.op;
    return;
  }
  saving.value = true;
  try {
    await session.ops.saveConnector(props.tenantId, draft.value.name, r.input);
    editing.value = false;
    $q.notify({ type: 'positive', message: t('admin.tenant.connectors.saved') });
    await load();
  } catch {
    error.value = t('admin.tenant.connectors.saveFailed');
  } finally {
    saving.value = false;
  }
}

// --- removing ------------------------------------------------------------------------
const removing = ref<Connector | null>(null);
const confirmOpen = computed({
  get: () => removing.value !== null,
  set: (v) => {
    if (!v) removing.value = null;
  },
});
const deleting = ref(false);

async function remove() {
  const c = removing.value;
  if (!c) return;
  deleting.value = true;
  try {
    await session.ops.deleteConnector(props.tenantId, c.name);
    removing.value = null;
    $q.notify({ type: 'positive', message: t('admin.tenant.connectors.deleted') });
    await load();
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    deleting.value = false;
  }
}

const mono =
  'font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px';
</script>

<template>
  <div>
    <div class="row items-center justify-between q-mb-md q-col-gutter-sm">
      <div class="col-12 col-sm">
        <div class="ig-section-title">{{ t('admin.tenant.connectors.title') }}</div>
        <div class="text-caption ig-muted">{{ t('admin.tenant.connectors.hint') }}</div>
      </div>
      <div class="col-12 col-sm-auto">
        <IgButton
          variant="primary"
          icon="add"
          :label="t('admin.tenant.connectors.add')"
          @click="start()"
        />
      </div>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>
    <q-skeleton v-if="loading && !items.length" height="120px" />
    <div v-else-if="!items.length && !failed" class="ig-card">
      <EmptyState
        icon="hub"
        :title="t('admin.tenant.connectors.empty')"
        :hint="t('admin.tenant.connectors.emptyHint')"
      />
    </div>

    <div class="column q-gutter-y-md">
      <div v-for="c in items" :key="c.name" class="ig-card q-pa-lg">
        <div class="row items-center justify-between q-mb-xs no-wrap">
          <div class="text-subtitle1 text-weight-bold ellipsis">{{ c.name }}</div>
          <span class="ig-pill" :class="c.enabled === false ? '' : 'ig-pill--ok'">
            {{
              c.enabled === false
                ? t('admin.tenant.connectors.off')
                : t('admin.tenant.connectors.on')
            }}
          </span>
        </div>
        <div class="text-caption ig-muted q-mb-sm">
          {{ hostOf(c.base_url) }} · {{ t(`admin.tenant.connectors.auth.${c.auth.type}`) }} ·
          {{
            c.has_secret
              ? t('admin.tenant.connectors.secretSet')
              : t('admin.tenant.connectors.noSecret')
          }}
        </div>
        <div v-for="o in c.operations" :key="o.name" class="row items-center q-py-xs no-wrap">
          <span class="ig-pill q-mr-sm" style="min-width: 58px; justify-content: center">
            {{ o.method }}
          </span>
          <span class="col ellipsis">{{ toolName(c.name, o.name) }}</span>
          <span
            class="ig-pill"
            :class="effectiveRisk(o) === 'read' ? 'ig-pill--ok' : 'ig-pill--warn'"
          >
            {{ t(`admin.tenant.connectors.risk.${effectiveRisk(o)}`) }}
          </span>
        </div>
        <div class="row q-gutter-x-sm q-mt-md">
          <IgButton
            variant="secondary"
            size="sm"
            icon="edit"
            :label="t('common.edit')"
            @click="start(c)"
          />
          <IgButton
            variant="ghost"
            size="sm"
            icon="delete_outline"
            :label="t('admin.tenant.connectors.delete')"
            @click="removing = c"
          />
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmOpen"
      destructive
      :loading="deleting"
      :title="t('admin.tenant.connectors.deleteTitle', { name: removing?.name ?? '' })"
      :message="t('admin.tenant.connectors.deleteBody')"
      :type-to-confirm="removing?.name ?? ''"
      :type-hint="t('admin.tenant.connectors.deleteType', { name: removing?.name ?? '' })"
      :confirm-label="t('admin.tenant.connectors.delete')"
      :cancel-label="t('common.cancel')"
      @confirm="remove"
    />

    <OpenApiImport v-model="importing" @add="addImported" />

    <q-dialog v-model="editing" :persistent="saving" :maximized="$q.screen.lt.sm">
      <q-card
        class="ig-card ig-card--raised column no-wrap"
        :style="
          $q.screen.lt.sm
            ? 'border-radius: 0'
            : 'width: 760px; max-width: 94vw; max-height: 92vh; border-radius: 20px'
        "
      >
        <q-form class="column no-wrap col" style="min-height: 0" @submit.prevent="save">
          <q-card-section>
            <div class="text-h6">
              {{
                draft.isNew
                  ? t('admin.tenant.connectors.add')
                  : t('admin.tenant.connectors.edit', { name: draft.name })
              }}
            </div>
          </q-card-section>

          <!-- Outside the scroll: the error must be seen wherever in the form the person is. -->
          <q-card-section v-if="error" class="q-py-none">
            <IgAlert tone="error">{{ error }}</IgAlert>
          </q-card-section>

          <q-card-section class="col q-gutter-y-md" style="overflow-y: auto; min-height: 0">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-5">
                <q-input
                  v-model="draft.name"
                  outlined
                  maxlength="24"
                  :readonly="!draft.isNew"
                  :autofocus="draft.isNew"
                  :label="t('admin.tenant.connectors.name')"
                  :hint="t('admin.tenant.connectors.nameHint')"
                />
              </div>
              <div class="col-12 col-sm-7">
                <q-input
                  v-model="draft.baseUrl"
                  outlined
                  inputmode="url"
                  :label="t('admin.tenant.connectors.baseUrl')"
                  :hint="t('admin.tenant.connectors.baseUrlHint')"
                />
              </div>
            </div>
            <q-input
              v-model="draft.description"
              outlined
              maxlength="1000"
              :label="t('admin.tenant.connectors.description')"
            />

            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-4">
                <q-select
                  v-model="draft.authType"
                  outlined
                  emit-value
                  map-options
                  :options="
                    AUTH_TYPES.map((a) => ({
                      value: a,
                      label: t(`admin.tenant.connectors.auth.${a}`),
                    }))
                  "
                  :label="t('admin.tenant.connectors.authType')"
                />
              </div>
              <div v-if="draft.authType === 'header'" class="col-12 col-sm-4">
                <q-input
                  v-model="draft.header"
                  outlined
                  maxlength="64"
                  :label="t('admin.tenant.connectors.header')"
                />
              </div>
              <div v-if="draft.authType !== 'none'" class="col-12 col-sm">
                <q-input
                  v-model="draft.secret"
                  outlined
                  type="password"
                  autocomplete="new-password"
                  :label="
                    draft.authType === 'basic'
                      ? t('admin.tenant.connectors.secretBasic')
                      : t('admin.tenant.connectors.secret')
                  "
                  :hint="
                    draft.hasSecret
                      ? t('admin.tenant.connectors.secretKeep')
                      : t('admin.tenant.connectors.secretNew')
                  "
                />
              </div>
            </div>
            <q-toggle v-model="draft.enabled" :label="t('admin.tenant.connectors.enabled')" />

            <div class="ig-section-title q-mt-md">
              {{ t('admin.tenant.connectors.operations') }}
            </div>
            <div class="text-caption ig-muted">
              {{ t('admin.tenant.connectors.operationsHint') }}
            </div>

            <q-list bordered separator style="border-radius: 14px; overflow: hidden">
              <q-expansion-item
                v-for="(o, i) in draft.operations"
                :key="i"
                :model-value="openOp === i"
                group="operations"
                @update:model-value="(v: boolean) => v && (openOp = i)"
              >
                <template #header>
                  <q-item-section avatar>
                    <span class="ig-pill" style="min-width: 58px; justify-content: center">
                      {{ o.method }}
                    </span>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="ellipsis">
                      {{
                        o.name
                          ? toolName(draft.name || '…', o.name)
                          : t('admin.tenant.connectors.newOperation')
                      }}
                    </q-item-label>
                  </q-item-section>
                </template>

                <div class="q-pa-md q-gutter-y-md">
                  <div class="row q-col-gutter-md">
                    <div class="col-12 col-sm-7">
                      <q-input
                        v-model="o.name"
                        outlined
                        dense
                        maxlength="40"
                        :label="t('admin.tenant.connectors.opName')"
                        :hint="t('admin.tenant.connectors.opNameHint')"
                      />
                    </div>
                    <div class="col-6 col-sm-2">
                      <q-select
                        v-model="o.method"
                        outlined
                        dense
                        :options="METHODS"
                        :label="t('admin.tenant.connectors.method')"
                      />
                    </div>
                    <div class="col-6 col-sm-3">
                      <q-select
                        v-model="o.risk"
                        outlined
                        dense
                        emit-value
                        map-options
                        :options="[
                          { value: '', label: t('admin.tenant.connectors.riskDefault') },
                          ...RISKS.map((r) => ({
                            value: r,
                            label: t(`admin.tenant.connectors.risk.${r}`),
                          })),
                        ]"
                        :label="t('admin.tenant.connectors.riskLabel')"
                      />
                    </div>
                  </div>
                  <q-input
                    v-model="o.description"
                    outlined
                    dense
                    maxlength="1000"
                    :label="t('admin.tenant.connectors.opDescription')"
                    :hint="t('admin.tenant.connectors.opDescriptionHint')"
                  />
                  <q-input
                    v-model="o.path"
                    outlined
                    dense
                    :label="t('admin.tenant.connectors.path')"
                    :hint="t('admin.tenant.connectors.pathHint')"
                  />
                  <q-input
                    v-model="o.params"
                    outlined
                    type="textarea"
                    :rows="6"
                    spellcheck="false"
                    :input-style="mono"
                    :label="t('admin.tenant.connectors.params')"
                    :hint="t('admin.tenant.connectors.paramsHint')"
                  />
                  <q-input
                    v-model="o.fields"
                    outlined
                    dense
                    type="textarea"
                    :rows="2"
                    spellcheck="false"
                    :input-style="mono"
                    :label="t('admin.tenant.connectors.fields')"
                    :hint="t('admin.tenant.connectors.fieldsHint')"
                  />
                  <div class="text-right">
                    <IgButton
                      variant="ghost"
                      size="sm"
                      icon="delete_outline"
                      :disable="draft.operations.length === 1"
                      :label="t('admin.tenant.connectors.removeOperation')"
                      @click="removeOperation(i)"
                    />
                  </div>
                </div>
              </q-expansion-item>
            </q-list>
            <div class="row q-gutter-sm">
              <IgButton
                variant="secondary"
                size="sm"
                icon="add"
                :label="t('admin.tenant.connectors.addOperation')"
                @click="addOperation"
              />
              <IgButton
                variant="secondary"
                size="sm"
                icon="upload_file"
                :label="t('admin.tenant.connectors.import.open')"
                @click="importing = true"
              />
            </div>
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
              :label="t('admin.tenant.connectors.save')"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </div>
</template>
