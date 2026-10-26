<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ApiError } from '@/api/http';
import type { Balance, CreditOrder, CreditPackage, LedgerEntry, UsageItem } from '@/api/tenant';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EChart from '@/components/EChart.vue';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { useSessionStore } from '@/stores/session';
import { axisStyle, lineSeries } from '@/utils/chartTheme';
import { daysUntil, fillDays, formatMinor, safeCheckoutUrl } from '@/utils/format';
import { chartColors, metricColors } from '@/utils/palette';
import { daysBefore, formatMicroUsd, periodLabel } from '@/utils/stats';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const balance = ref<Balance | null>(null);
const usage = ref<UsageItem[]>([]);
const packages = ref<CreditPackage[]>([]);
const orders = ref<CreditOrder[]>([]);
const ledger = ref<LedgerEntry[]>([]);
const ledgerCursor = ref<string | undefined>();
const loading = ref(true);
const failed = ref(false);
const ledgerLoading = ref(false);

const toBuy = ref<CreditPackage | null>(null);
const buying = ref(false);
const confirmBuy = computed({
  get: () => toBuy.value !== null,
  set: (v) => {
    if (!v) toBuy.value = null;
  },
});

const LOT_COLORS = {
  plan: chartColors.brand,
  purchase: chartColors.gold,
  courtesy: chartColors.violet,
};

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

async function load() {
  loading.value = true;
  failed.value = false;
  const today = new Date();
  try {
    const [b, u, p, o, l] = await Promise.all([
      session.data.balance(),
      session.data.usage({ from: daysBefore(today, 29), to: daysBefore(today, 0), by: 'day' }),
      session.data.packages(),
      session.data.orders(),
      session.data.ledger({ limit: 20 }),
    ]);
    balance.value = b;
    usage.value = u.items;
    packages.value = p.items.filter((x) => x.active);
    orders.value = o.items;
    ledger.value = l.items;
    ledgerCursor.value = l.next_cursor;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

async function moreLedger() {
  if (!ledgerCursor.value) return;
  ledgerLoading.value = true;
  try {
    const page = await session.data.ledger({ cursor: ledgerCursor.value, limit: 20 });
    ledger.value = [...ledger.value, ...page.items];
    ledgerCursor.value = page.next_cursor;
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    ledgerLoading.value = false;
  }
}

onMounted(load);

const soonest = computed(() => {
  const lots = (balance.value?.lots ?? []).filter((l) => l.remaining_micro > 0);
  return lots.length ? Math.min(...lots.map((l) => daysUntil(l.expires_at))) : null;
});
const expiringSoon = computed(() => soonest.value !== null && soonest.value <= 7);

const expiryText = (iso: string) => {
  const d = daysUntil(iso);
  return d === 0 ? t('tenant.credits.expiresToday') : t('tenant.credits.expiresIn', { days: d });
};

const chartDays = computed(() => {
  const today = new Date();
  return fillDays(
    usage.value.map((u) => ({ key: u.key, value: u.charged_micro / 1_000_000 })),
    daysBefore(today, 29),
    daysBefore(today, 0),
  );
});
const hasUsage = computed(() => usage.value.some((u) => u.charged_micro > 0));

const usageOption = computed(() => ({
  grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
  tooltip: {
    trigger: 'axis',
    valueFormatter: (v: number) => formatMicroUsd(v * 1_000_000),
  },
  xAxis: {
    ...axisStyle.xAxis,
    boundaryGap: false,
    data: chartDays.value.map((d) => periodLabel(d.day, 'day')),
  },
  yAxis: { ...axisStyle.yAxis, axisLabel: { fontSize: 11, formatter: (v: number) => `$${v}` } },
  series: [
    lineSeries(
      t('tenant.credits.usage'),
      chartDays.value.map((d) => d.value),
      metricColors.charged_micro,
      { area: true },
    ),
  ],
}));

async function buy() {
  const pkg = toBuy.value;
  if (!pkg) return;
  buying.value = true;
  try {
    const order = await session.data.placeOrder(pkg.id);
    const url = safeCheckoutUrl(order.checkout_url);
    if (!url) {
      $q.notify({ type: 'negative', message: t('tenant.credits.badCheckout') });
      await load();
      return;
    }
    window.location.assign(url);
  } catch (e) {
    $q.notify({
      type: 'warning',
      message:
        e instanceof ApiError && e.status === 503
          ? t('tenant.credits.noGateway')
          : t('common.loadError'),
    });
  } finally {
    buying.value = false;
    toBuy.value = null;
  }
}

const packageOf = (id: string) => packages.value.find((p) => p.id === id);
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('tenant.nav.credits') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('tenant.credits.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t('tenant.credits.intro') }}</p>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>
    <IgAlert v-if="expiringSoon" tone="warn" class="q-mb-md">
      {{ t('tenant.credits.expiringSoon') }}
    </IgAlert>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-5">
        <div class="ig-card ig-balance full-height">
          <div class="ig-eyebrow">{{ t('tenant.credits.available') }}</div>
          <q-skeleton v-if="loading && !balance" height="56px" width="200px" class="q-my-sm" />
          <div v-else class="ig-balance__value ig-num">
            {{ formatMicroUsd(balance?.balance_micro ?? 0) }}
          </div>

          <div v-if="balance?.lots.length" class="q-mt-md">
            <div class="ig-section-title q-mb-sm">{{ t('tenant.credits.lots') }}</div>
            <div v-for="(l, i) in balance.lots" :key="i" class="ig-lot">
              <div class="row items-center no-wrap q-mb-xs">
                <span class="ig-legend__dot q-mr-sm" :style="{ background: LOT_COLORS[l.kind] }" />
                <span class="text-weight-medium col">{{
                  t(`tenant.credits.lotKind.${l.kind}`)
                }}</span>
                <span class="text-caption ig-muted">{{ expiryText(l.expires_at) }}</span>
              </div>
              <div class="ig-bar">
                <div
                  class="ig-bar__fill"
                  :style="{
                    width: `${l.initial_micro ? Math.min(100, (l.remaining_micro / l.initial_micro) * 100) : 0}%`,
                    background: LOT_COLORS[l.kind],
                  }"
                />
              </div>
              <div class="text-caption ig-muted q-mt-xs ig-num">
                {{
                  t('tenant.credits.remaining', {
                    left: formatMicroUsd(l.remaining_micro),
                    total: formatMicroUsd(l.initial_micro),
                  })
                }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-7">
        <div class="ig-card q-pa-md full-height">
          <div class="ig-section-title q-mb-sm">{{ t('tenant.credits.usage') }}</div>
          <q-skeleton v-if="loading && !usage.length" height="240px" />
          <EChart
            v-else-if="hasUsage"
            :option="usageOption"
            :height="240"
            :label="t('tenant.credits.usage')"
          />
          <EmptyState v-else icon="insights" :title="t('tenant.credits.noUsage')" />
        </div>
      </div>
    </div>

    <div class="q-mb-md">
      <h2 class="text-h6 q-mt-lg q-mb-xs">{{ t('tenant.credits.packages') }}</h2>
      <p class="ig-muted q-mb-md">{{ t('tenant.credits.packagesHint') }}</p>
      <div v-if="!packages.length && !loading" class="ig-card">
        <EmptyState icon="inventory_2" :title="t('tenant.credits.noPackages')" />
      </div>
      <div class="row q-col-gutter-md">
        <div v-for="p in packages" :key="p.id" class="col-12 col-sm-6 col-lg-4">
          <div class="ig-card ig-package q-pa-lg">
            <div class="text-subtitle1 text-weight-bold">{{ p.name }}</div>
            <div class="ig-package__credit ig-num">{{ formatMicroUsd(p.credit_micro) }}</div>
            <div class="ig-muted q-mb-md">{{ t('tenant.credits.packageCredit') }}</div>
            <div class="row items-center justify-between">
              <div class="text-h6 ig-num">{{ formatMinor(p.price_minor, p.currency) }}</div>
              <IgButton variant="primary" :label="t('tenant.credits.buy')" @click="toBuy = p" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-lg-5">
        <div class="ig-card" style="overflow: hidden">
          <div class="ig-section-title q-pa-md q-pb-sm">{{ t('tenant.credits.orders') }}</div>
          <EmptyState
            v-if="!orders.length && !loading"
            icon="receipt_long"
            :title="t('tenant.credits.noOrders')"
          />
          <div v-for="o in orders" :key="o.id" class="ig-row" style="cursor: default">
            <div class="col" style="min-width: 0">
              <div class="text-weight-medium">
                {{ packageOf(o.package_id)?.name ?? formatMicroUsd(o.credit_micro) }}
              </div>
              <div class="text-caption ig-muted">{{ when(o.created_at) }}</div>
            </div>
            <div class="text-right">
              <div class="text-weight-bold ig-num">
                {{ formatMinor(o.price_minor, o.currency) }}
              </div>
              <span
                class="ig-pill"
                :class="{
                  'ig-pill--ok': o.status === 'paid',
                  'ig-pill--warn': o.status === 'pending',
                }"
                :style="
                  o.status === 'failed'
                    ? 'background: var(--ig-error-bg); color: var(--ig-error)'
                    : ''
                "
              >
                {{ t(`tenant.credits.orderStatus.${o.status}`) }}
              </span>
            </div>
            <IgButton
              v-if="o.status === 'pending' && safeCheckoutUrl(o.checkout_url)"
              variant="secondary"
              size="sm"
              :label="t('tenant.credits.pay')"
              :href="safeCheckoutUrl(o.checkout_url) ?? undefined"
            />
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-7">
        <div class="ig-card" style="overflow: hidden">
          <div class="ig-section-title q-pa-md q-pb-sm">{{ t('tenant.credits.ledger') }}</div>
          <EmptyState v-if="!ledger.length && !loading" icon="receipt" :title="t('common.empty')" />
          <div v-for="e in ledger" :key="e.id" class="ig-row" style="cursor: default">
            <div class="col" style="min-width: 0">
              <div class="text-weight-medium">{{ t(`tenant.credits.ledgerKind.${e.kind}`) }}</div>
              <div class="text-caption ig-muted ellipsis">
                {{ when(e.created_at) }}<template v-if="e.model"> · {{ e.model }}</template>
                <template v-if="e.estimated"> · {{ t('tenant.credits.estimated') }}</template>
              </div>
            </div>
            <div
              class="text-weight-bold ig-num"
              :style="e.amount_micro > 0 ? 'color: var(--ig-ok)' : ''"
            >
              {{ e.amount_micro > 0 ? '+' : '' }}{{ formatMicroUsd(e.amount_micro) }}
            </div>
          </div>
          <div v-if="ledgerCursor" class="q-pa-sm text-center">
            <IgButton
              variant="ghost"
              size="sm"
              :loading="ledgerLoading"
              :label="t('common.loadMore')"
              @click="moreLedger"
            />
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmBuy"
      :loading="buying"
      :title="t('tenant.credits.buyTitle')"
      :message="
        toBuy
          ? t('tenant.credits.buyBody', {
              name: toBuy.name,
              credit: formatMicroUsd(toBuy.credit_micro),
              price: formatMinor(toBuy.price_minor, toBuy.currency),
            })
          : ''
      "
      :confirm-label="t('tenant.credits.buyGo')"
      :cancel-label="t('common.cancel')"
      @confirm="buy"
    />
  </q-page>
</template>
