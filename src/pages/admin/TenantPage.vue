<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import type { Catalog, Entitlements, LimitDef, Statement, TenantListItem } from '@/api/ops';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import AutomationsPanel from '@/components/AutomationsPanel.vue';
import TenantConnectors from '@/components/TenantConnectors.vue';
import { useSessionStore } from '@/stores/session';
import { diffLimits, diffModules, usdToMicro } from '@/utils/plan';
import { isEmail, isHttpsOrEmpty, parseRecipients } from '@/utils/validate';
import { daysBefore, formatMicroUsd } from '@/utils/stats';

const { t } = useI18n();
const $q = useQuasar();
const route = useRoute();
const session = useSessionStore();

const id = String(route.params.id);
const tenant = ref<TenantListItem | null>(null);
const catalog = ref<Catalog | null>(null);
const ent = ref<Entitlements | null>(null);
const loading = ref(true);
const failed = ref(false);
const missing = ref(false);
type Tab = 'plan' | 'security' | 'credits' | 'mail' | 'connectors' | 'automations' | 'privacy';
const tab = ref<Tab>('plan');
const connectorsSeen = ref(false);
const automationsSeen = ref(false);

// --- load -------------------------------------------------------------------
async function load() {
  loading.value = true;
  failed.value = false;
  try {
    const [list, cat, e] = await Promise.all([
      session.ops.tenants({ limit: 200 }),
      session.ops.catalog(),
      session.ops.entitlements(id),
    ]);
    tenant.value = list.items.find((x) => x.id === id) ?? null;
    missing.value = tenant.value === null;
    catalog.value = cat;
    ent.value = e;
    resetPlan();
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

// --- plan ---------------------------------------------------------------------
const modules = ref<string[]>([]);
/** The limits that differ from the default, edited in place. */
const overrides = ref<Record<string, number>>({});
const llmModel = ref('');
const downgrade = ref(true);
const capWarn = ref(80);
const lowBalance = ref('0');
const saving = ref(false);
const confirmOpen = ref(false);
const planVersion = ref(0);

function resetPlan() {
  const e = ent.value;
  if (!e) return;
  modules.value = [...e.modules];
  overrides.value = { ...e.limits };
  llmModel.value = e.llm_model;
  downgrade.value = e.downgrade_near_cap;
  capWarn.value = e.cap_warn_percent;
  lowBalance.value = String(e.low_balance_micro / 1_000_000);
}

// The limits of what the tenant has contracted, plus the core ones.
const defs = computed<LimitDef[]>(() => {
  const c = catalog.value;
  if (!c) return [];
  const own = c.modules.filter((m) => modules.value.includes(m.id)).flatMap((m) => m.limits);
  return [...c.core_limits, ...own];
});

const value = (d: LimitDef) => overrides.value[d.key] ?? d.default;
const isCustom = (d: LimitDef) => d.key in overrides.value;

function setLimit(d: LimitDef, v: string | number | null) {
  const n = Number(v);
  if (v === null || v === '' || !Number.isInteger(n) || n < -1) return;
  if (n === d.default) delete overrides.value[d.key];
  else overrides.value[d.key] = n;
}

function resetLimit(d: LimitDef) {
  delete overrides.value[d.key];
}

const lowBalanceMicro = computed(() => usdToMicro(lowBalance.value));

const planPatch = computed(() => {
  const e = ent.value;
  if (!e) return {};
  const patch: Record<string, unknown> = {};
  const m = diffModules(e.modules, modules.value);
  if (m.added.length || m.removed.length) patch.modules = modules.value;
  const known = new Set([...defs.value.map((d) => d.key), ...Object.keys(e.limits)]);
  const next: Record<string, number | null> = {};
  for (const k of known) next[k] = overrides.value[k] ?? null;
  const l = diffLimits(e.limits, next);
  if (Object.keys(l).length) patch.limits = l;
  if (llmModel.value !== e.llm_model) patch.llm_model = llmModel.value;
  if (downgrade.value !== e.downgrade_near_cap) patch.downgrade_near_cap = downgrade.value;
  if (capWarn.value !== e.cap_warn_percent) patch.cap_warn_percent = capWarn.value;
  if (lowBalanceMicro.value !== null && lowBalanceMicro.value !== e.low_balance_micro)
    patch.low_balance_micro = lowBalanceMicro.value;
  return patch;
});
const dirty = computed(() => Object.keys(planPatch.value).length > 0);
const moveSummary = computed(() =>
  ent.value ? diffModules(ent.value.modules, modules.value) : { added: [], removed: [] },
);
// What the confirmation lists: the limits and settings that are about to change.
const changeLines = computed(() => {
  const e = ent.value;
  const p = planPatch.value as { limits?: Record<string, number | null> };
  const lines: string[] = [];
  if (e && p.limits) {
    const defaults = new Map(defs.value.map((d) => [d.key, d.default]));
    for (const [key, next] of Object.entries(p.limits)) {
      const before = e.limits[key] ?? defaults.get(key);
      const after = next ?? defaults.get(key);
      lines.push(`${key}: ${before ?? '—'} → ${after ?? t('admin.tenant.plan.default')}`);
    }
  }
  const p2 = planPatch.value;
  if ('llm_model' in p2)
    lines.push(
      `${t('admin.tenant.plan.model')}: ${llmModel.value || t('admin.tenant.plan.modelProfile')}`,
    );
  if ('downgrade_near_cap' in p2)
    lines.push(
      `${t('admin.tenant.plan.downgrade')}: ${downgrade.value ? t('common.yes') : t('common.no')}`,
    );
  if ('cap_warn_percent' in p2) lines.push(`${t('admin.tenant.plan.capWarn')}: ${capWarn.value}%`);
  if ('low_balance_micro' in p2)
    lines.push(`${t('admin.tenant.plan.lowBalance')}: ${lowBalance.value}`);
  return lines;
});

const planValid = computed(
  () => lowBalanceMicro.value !== null && capWarn.value >= 1 && capWarn.value <= 100,
);

async function savePlan() {
  saving.value = true;
  try {
    ent.value = await session.ops.patchEntitlements(id, planPatch.value);
    // The tabs that depend on the modules loaded with the old plan: they load again.
    planVersion.value++;
    // What depends on the plan is read again the next time its tab opens.
    mfaLoaded.value = false;
    mailLoaded.value = false;
    privacyLoaded.value = false;
    statement.value = null;
    resetPlan();
    confirmOpen.value = false;
    $q.notify({ type: 'positive', message: t('admin.tenant.plan.saved') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    saving.value = false;
  }
}

const modelOptions = computed(() => [
  { value: '', label: t('admin.tenant.plan.modelProfile') },
  ...(catalog.value?.models ?? []).map((m) => ({ value: m.model, label: m.model })),
]);

const unitText = (d: LimitDef) => {
  if (d.unit <= 1) return '';
  const mb = d.unit / (1024 * 1024);
  return mb >= 1 ? `× ${mb} MB` : `× ${d.unit / 1024} KB`;
};

// --- security -------------------------------------------------------------
const mfaRequired = ref(false);
const mfaLoaded = ref(false);
const mfaBusy = ref(false);

async function loadSecurity() {
  try {
    mfaRequired.value = (await session.ops.security(id)).mfa_required;
    mfaLoaded.value = true;
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  }
}

async function setMfa(v: boolean) {
  mfaBusy.value = true;
  try {
    await session.ops.setSecurity(id, v);
    mfaRequired.value = v;
    $q.notify({ type: 'positive', message: t('admin.tenant.security.saved') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    mfaBusy.value = false;
  }
}

// --- mail ---------------------------------------------------------------------
const mailLoaded = ref(false);
const mailName = ref('');
const mailText = ref('');
const mailError = ref('');
const mailSaving = ref(false);
const mailList = computed(() => parseRecipients(mailText.value));

async function loadMail() {
  try {
    const m = await session.ops.mail(id);
    mailName.value = m.business_name;
    mailText.value = m.recipients.join('\n');
    mailLoaded.value = true;
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  }
}

async function saveMail() {
  mailError.value = '';
  const bad = mailList.value.find((e) => !isEmail(e));
  if (!mailName.value.trim()) return void (mailError.value = t('auth.errors.required'));
  if (!mailList.value.length) return void (mailError.value = t('admin.tenant.mail.none'));
  if (mailList.value.length > 5) return void (mailError.value = t('admin.tenant.mail.tooMany'));
  if (bad) return void (mailError.value = t('admin.tenant.mail.invalidEmail', { email: bad }));
  mailSaving.value = true;
  try {
    await session.ops.saveMail(id, {
      business_name: mailName.value.trim(),
      recipients: mailList.value,
    });
    $q.notify({ type: 'positive', message: t('admin.tenant.mail.saved') });
  } catch {
    mailError.value = t('common.loadError');
  } finally {
    mailSaving.value = false;
  }
}

// --- privacy --------------------------------------------------------------------
const privacyLoaded = ref(false);
const pBusiness = ref('');
const pNotice = ref('');
const pPolicy = ref('');
const pError = ref('');
const pSaving = ref(false);

async function loadPrivacy() {
  try {
    const p = await session.ops.privacy(id);
    pBusiness.value = p.business_name;
    pNotice.value = p.notice_text;
    pPolicy.value = p.policy_url;
    privacyLoaded.value = true;
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  }
}

async function savePrivacy() {
  pError.value = '';
  if (!isHttpsOrEmpty(pPolicy.value))
    return void (pError.value = t('admin.tenant.privacy.policyInvalid'));
  pSaving.value = true;
  try {
    await session.ops.savePrivacy(id, {
      business_name: pBusiness.value.trim(),
      notice_text: pNotice.value,
      policy_url: pPolicy.value.trim(),
    });
    $q.notify({ type: 'positive', message: t('admin.tenant.privacy.saved') });
  } catch {
    pError.value = t('common.loadError');
  } finally {
    pSaving.value = false;
  }
}

// --- credits ----------------------------------------------------------------
const statement = ref<Statement | null>(null);
const stLoading = ref(false);
const amount = ref('');
const kind = ref<'purchase' | 'courtesy'>('purchase');
const expires = ref('');
const grantError = ref('');
const grantOpen = ref(false);
const granting = ref(false);
const amountMicro = computed(() => usdToMicro(amount.value));

async function loadStatement() {
  stLoading.value = true;
  try {
    const today = new Date();
    statement.value = await session.ops.statement(id, {
      from: daysBefore(today, 29),
      to: daysBefore(today, -1),
    });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    stLoading.value = false;
  }
}

function askGrant() {
  grantError.value = '';
  if (amountMicro.value === null || amountMicro.value <= 0)
    return void (grantError.value = t('admin.tenant.credits.amountInvalid'));
  if (kind.value === 'courtesy' && !expires.value)
    return void (grantError.value = t('admin.tenant.credits.expiresRequired'));
  grantOpen.value = true;
}

async function grant() {
  if (amountMicro.value === null) return;
  granting.value = true;
  try {
    await session.ops.grant({
      tenant_id: id,
      amount_micro: amountMicro.value,
      // One key per confirmed attempt: pressing the button twice never credits twice.
      idempotency_key: `console-${crypto.randomUUID()}`,
      kind: kind.value,
      ...(kind.value === 'courtesy' && {
        expires_at: new Date(`${expires.value}T23:59:59Z`).toISOString(),
      }),
    });
    grantOpen.value = false;
    amount.value = '';
    expires.value = '';
    $q.notify({ type: 'positive', message: t('admin.tenant.credits.granted') });
    await loadStatement();
  } catch {
    grantOpen.value = false;
    grantError.value = t('common.loadError');
  } finally {
    granting.value = false;
  }
}

function onTab(v: Tab) {
  tab.value = v;
  // Every time a data tab opens it asks again, so it never shows what was true before a change.
  if (v === 'connectors') {
    connectorsSeen.value = true;
    planVersion.value++;
  }
  if (v === 'automations') {
    automationsSeen.value = true;
    planVersion.value++;
  }
  if (v === 'security' && !mfaLoaded.value) void loadSecurity();
  if (v === 'credits' && !statement.value) void loadStatement();
  if (v === 'mail' && !mailLoaded.value) void loadMail();
  if (v === 'privacy' && !privacyLoaded.value) void loadPrivacy();
}

onMounted(load);

const STATEMENT_ROWS = [
  'opening',
  'plan',
  'purchased',
  'courtesy',
  'charged',
  'expired',
  'other',
  'closing',
] as const;
const statementValue = (k: (typeof STATEMENT_ROWS)[number]) =>
  statement.value ? statement.value[`${k}_micro`] : 0;
</script>

<template>
  <q-page padding>
    <router-link
      to="/admin/tenants"
      class="row items-center no-wrap q-mb-md"
      style="text-decoration: none"
    >
      <q-icon name="arrow_back" class="q-mr-xs" /> {{ t('admin.tenant.back') }}
    </router-link>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>
    <q-skeleton v-if="loading && !tenant" height="80px" />

    <template v-if="tenant || ent">
      <div class="row items-center q-mb-lg no-wrap">
        <span class="ig-avatar ig-avatar--lg q-mr-md">{{
          (tenant?.name ?? '?').charAt(0).toUpperCase()
        }}</span>
        <div class="col" style="min-width: 0">
          <h1 class="text-h4 q-my-none ellipsis">{{ tenant?.name ?? id }}</h1>
          <div class="ig-muted ellipsis">{{ tenant?.slug }}</div>
        </div>
        <span
          v-if="tenant"
          class="ig-pill"
          :class="tenant.status === 'active' ? 'ig-pill--ok' : 'ig-pill--warn'"
        >
          {{ t(`admin.tenants.status.${tenant.status}`) }}
        </span>
      </div>

      <div class="ig-scroll-x q-mb-md">
        <IgSegmented
          :model-value="tab"
          :label="t('admin.tenant.back')"
          :options="[
            { value: 'plan', label: t('admin.tenant.tabs.plan') },
            { value: 'security', label: t('admin.tenant.tabs.security') },
            { value: 'credits', label: t('admin.tenant.tabs.credits') },
            { value: 'mail', label: t('admin.tenant.tabs.mail') },
            { value: 'connectors', label: t('admin.tenant.tabs.connectors') },
            { value: 'automations', label: t('admin.tenant.tabs.automations') },
            { value: 'privacy', label: t('admin.tenant.tabs.privacy') },
          ]"
          @update:model-value="onTab"
        />
      </div>

      <!-- Connectors: loaded when the tab is first opened and kept after that -->
      <TenantConnectors
        v-if="connectorsSeen"
        :key="`c${planVersion}`"
        v-show="tab === 'connectors'"
        :tenant-id="id"
      />

      <!-- Automations: loaded when the tab is first opened and kept after that -->
      <AutomationsPanel
        v-if="automationsSeen"
        :key="`a${planVersion}`"
        v-show="tab === 'automations'"
        operator
        :client="session.ops.automationsOf(id)"
        :load-connectors="async () => (await session.ops.connectors(id)).items"
      />

      <!-- Plan -->
      <div v-if="tab === 'plan' && ent" class="column q-gutter-y-md">
        <div class="ig-card q-pa-lg">
          <div class="ig-section-title">{{ t('admin.tenant.plan.modules') }}</div>
          <div class="text-caption ig-muted q-mb-sm">{{ t('admin.tenant.plan.modulesHint') }}</div>
          <div class="row q-col-gutter-sm">
            <div v-for="m in catalog?.modules" :key="m.id" class="col-12 col-sm-6">
              <q-checkbox v-model="modules" :val="m.id" color="primary" :label="m.id" />
              <div class="text-caption ig-muted q-ml-xl">{{ m.description }}</div>
            </div>
          </div>
        </div>

        <div class="ig-card q-pa-lg">
          <div class="ig-section-title">{{ t('admin.tenant.plan.limits') }}</div>
          <div class="text-caption ig-muted q-mb-md">{{ t('admin.tenant.plan.limitsHint') }}</div>
          <div v-for="d in defs" :key="d.key" class="row items-center q-col-gutter-sm q-mb-sm">
            <div class="col-12 col-sm-6">
              <div class="text-weight-medium ig-code" style="font-size: 0.85rem">{{ d.key }}</div>
              <div class="text-caption ig-muted">{{ d.description }}</div>
            </div>
            <div class="col-8 col-sm-4">
              <q-input
                :model-value="value(d)"
                type="number"
                outlined
                dense
                :suffix="unitText(d)"
                :hint="isCustom(d) ? `${t('admin.tenant.plan.default')}: ${d.default}` : ''"
                @update:model-value="setLimit(d, $event)"
              />
            </div>
            <div class="col-4 col-sm-2">
              <span class="ig-pill" :class="isCustom(d) ? 'ig-pill--brand' : ''">
                {{
                  value(d) === -1
                    ? t('admin.tenant.plan.unlimited')
                    : isCustom(d)
                      ? t('admin.tenant.plan.custom')
                      : t('admin.tenant.plan.default')
                }}
              </span>
              <IgButton
                v-if="isCustom(d)"
                variant="ghost"
                size="sm"
                icon-only
                icon="undo"
                :label="t('admin.tenant.plan.useDefault')"
                @click="resetLimit(d)"
              />
            </div>
          </div>
        </div>

        <div class="ig-card q-pa-lg q-gutter-y-md">
          <q-select
            v-model="llmModel"
            outlined
            emit-value
            map-options
            :options="modelOptions"
            :label="t('admin.tenant.plan.model')"
          />
          <q-toggle v-model="downgrade" :label="t('admin.tenant.plan.downgrade')" color="primary" />
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input
                v-model.number="capWarn"
                type="number"
                outlined
                min="1"
                max="100"
                suffix="%"
                :label="t('admin.tenant.plan.capWarn')"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="lowBalance"
                outlined
                inputmode="decimal"
                :label="t('admin.tenant.plan.lowBalance')"
                :error="lowBalanceMicro === null"
              />
            </div>
          </div>
        </div>

        <div class="row justify-end q-gutter-x-sm">
          <IgButton
            variant="ghost"
            :disable="!dirty"
            :label="t('admin.tenant.plan.reset')"
            @click="resetPlan"
          />
          <IgButton
            variant="primary"
            :disable="!dirty || !planValid"
            :label="t('admin.tenant.plan.save')"
            @click="confirmOpen = true"
          />
        </div>
      </div>

      <!-- Security -->
      <div v-else-if="tab === 'security'" class="ig-card q-pa-lg">
        <q-skeleton v-if="!mfaLoaded" height="60px" />
        <template v-else>
          <q-toggle
            :model-value="mfaRequired"
            :disable="mfaBusy"
            color="primary"
            :label="t('admin.tenant.security.mfa')"
            @update:model-value="setMfa"
          />
          <div class="text-caption ig-muted q-mt-sm">{{ t('admin.tenant.security.mfaHint') }}</div>
        </template>
      </div>

      <!-- Mail -->
      <q-form
        v-else-if="tab === 'mail'"
        class="ig-card q-pa-lg q-gutter-y-md"
        @submit.prevent="saveMail"
      >
        <q-skeleton v-if="!mailLoaded" height="140px" />
        <template v-else>
          <IgAlert v-if="mailError" tone="error">{{ mailError }}</IgAlert>
          <IgAlert v-else-if="!mailList.length" tone="warn">{{
            t('admin.tenant.mail.notConfigured')
          }}</IgAlert>
          <q-input
            v-model="mailName"
            outlined
            maxlength="80"
            :label="t('admin.tenant.mail.business')"
            :hint="t('admin.tenant.mail.businessHint')"
          />
          <q-input
            v-model="mailText"
            outlined
            type="textarea"
            autogrow
            :label="t('admin.tenant.mail.recipients')"
            :hint="t('admin.tenant.mail.recipientsHint')"
          />
          <div class="row justify-end">
            <IgButton
              type="submit"
              variant="primary"
              :loading="mailSaving"
              :label="t('common.save')"
            />
          </div>
        </template>
      </q-form>

      <!-- Privacy -->
      <q-form
        v-else-if="tab === 'privacy'"
        class="ig-card q-pa-lg q-gutter-y-md"
        @submit.prevent="savePrivacy"
      >
        <q-skeleton v-if="!privacyLoaded" height="200px" />
        <template v-else>
          <IgAlert v-if="pError" tone="error">{{ pError }}</IgAlert>
          <q-input
            v-model="pBusiness"
            outlined
            maxlength="80"
            :label="t('admin.tenant.privacy.business')"
          />
          <q-input
            v-model="pNotice"
            outlined
            type="textarea"
            autogrow
            maxlength="1500"
            counter
            :label="t('admin.tenant.privacy.notice')"
            :hint="t('admin.tenant.privacy.noticeHint')"
          />
          <q-input
            v-model="pPolicy"
            outlined
            inputmode="url"
            :label="t('admin.tenant.privacy.policy')"
          />
          <div class="row justify-end">
            <IgButton
              type="submit"
              variant="primary"
              :loading="pSaving"
              :label="t('common.save')"
            />
          </div>
        </template>
      </q-form>

      <!-- Credits -->
      <div v-else-if="tab === 'credits'" class="row q-col-gutter-md">
        <div class="col-12 col-md-6">
          <div class="ig-card q-pa-lg full-height">
            <div class="ig-section-title q-mb-md">{{ t('admin.tenant.credits.statement') }}</div>
            <q-skeleton v-if="stLoading && !statement" height="200px" />
            <template v-else-if="statement">
              <div
                v-for="k in STATEMENT_ROWS"
                :key="k"
                class="row items-center justify-between q-py-xs"
                :class="k === 'closing' ? 'text-weight-bold' : ''"
                :style="
                  k === 'closing'
                    ? 'border-top: 1px solid var(--ig-line); margin-top: 6px; padding-top: 10px'
                    : ''
                "
              >
                <span :class="k === 'closing' ? '' : 'ig-muted'">{{
                  t(`admin.tenant.credits.${k}`)
                }}</span>
                <span class="ig-num">{{ formatMicroUsd(statementValue(k)) }}</span>
              </div>
            </template>
          </div>
        </div>
        <div class="col-12 col-md-6">
          <q-form class="ig-card q-pa-lg q-gutter-y-md" @submit.prevent="askGrant">
            <div class="ig-section-title">{{ t('admin.tenant.credits.grant') }}</div>
            <IgAlert v-if="grantError" tone="error">{{ grantError }}</IgAlert>
            <IgSegmented
              v-model="kind"
              block
              :label="t('admin.tenant.credits.kind')"
              :options="[
                { value: 'purchase', label: t('admin.tenant.credits.kindPurchase') },
                { value: 'courtesy', label: t('admin.tenant.credits.kindCourtesy') },
              ]"
            />
            <q-input
              v-model="amount"
              outlined
              inputmode="decimal"
              :label="t('admin.tenant.credits.amount')"
            />
            <q-input
              v-if="kind === 'courtesy'"
              v-model="expires"
              outlined
              type="date"
              stack-label
              :label="t('admin.tenant.credits.expires')"
              :hint="t('admin.tenant.credits.expiresHint')"
            />
            <IgButton
              type="submit"
              variant="primary"
              block
              :label="t('admin.tenant.credits.grant')"
            />
          </q-form>
        </div>
      </div>
    </template>

    <ConfirmDialog
      v-model="confirmOpen"
      :loading="saving"
      :title="t('admin.tenant.plan.confirmTitle')"
      :message="
        [
          moveSummary.removed.length
            ? t('admin.tenant.plan.removed', { list: moveSummary.removed.join(', ') })
            : '',
          moveSummary.added.length
            ? t('admin.tenant.plan.added', { list: moveSummary.added.join(', ') })
            : '',
          ...changeLines,
          t('admin.tenant.plan.applies'),
        ]
          .filter(Boolean)
          .join('\n')
      "
      :confirm-label="t('admin.tenant.plan.save')"
      :cancel-label="t('common.cancel')"
      @confirm="savePlan"
    />
    <ConfirmDialog
      v-model="grantOpen"
      :loading="granting"
      :title="t('admin.tenant.credits.grant')"
      :message="
        t('admin.tenant.credits.grantConfirm', {
          amount: formatMicroUsd(amountMicro ?? 0),
          name: tenant?.name ?? id,
        })
      "
      :confirm-label="t('admin.tenant.credits.grant')"
      :cancel-label="t('common.cancel')"
      @confirm="grant"
    />
  </q-page>
</template>
