<script setup lang="ts">
import { useQuasar } from 'quasar';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CreditPackage } from '@/api/tenant';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { useSessionStore } from '@/stores/session';
import { usdToMicro } from '@/utils/plan';
import { formatMicroUsd } from '@/utils/stats';
import { formatMinor } from '@/utils/format';
import { majorToMinor } from '@/utils/validate';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const packages = ref<CreditPackage[]>([]);
const loading = ref(true);
const failed = ref(false);
const busy = ref<string | null>(null);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    packages.value = (await session.ops.packages()).items;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function toggle(p: CreditPackage) {
  busy.value = p.id;
  try {
    await session.ops.setPackageActive(p.id, !p.active);
    packages.value = packages.value.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x));
    $q.notify({ type: 'positive', message: t('admin.packages.updated') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    busy.value = null;
  }
}

// --- new package ---------------------------------------------------------------
const creating = ref(false);
const saving = ref(false);
const error = ref('');
const form = ref({ name: '', credit: '', price: '', currency: 'USD' });

function start() {
  form.value = { name: '', credit: '', price: '', currency: 'USD' };
  error.value = '';
  creating.value = true;
}

async function create() {
  error.value = '';
  const f = form.value;
  const credit = usdToMicro(f.credit);
  const price = majorToMinor(f.price);
  if (!f.name.trim() || !credit || !price || !/^[A-Za-z]{3}$/.test(f.currency)) {
    error.value = t('admin.packages.invalid');
    return;
  }
  saving.value = true;
  try {
    const created = await session.ops.createPackage({
      name: f.name.trim(),
      credit_micro: credit,
      price_minor: price,
      currency: f.currency.toUpperCase(),
    });
    packages.value = [created, ...packages.value];
    creating.value = false;
    $q.notify({ type: 'positive', message: t('admin.packages.created') });
  } catch {
    error.value = t('common.loadError');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <q-page padding>
    <div class="row items-end justify-between q-mb-lg q-col-gutter-md">
      <div class="col-12 col-sm">
        <div class="ig-eyebrow q-mb-xs">{{ t('admin.nav.packages') }}</div>
        <h1 class="text-h4 q-my-none">{{ t('admin.packages.title') }}</h1>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('admin.packages.intro') }}</p>
      </div>
      <div class="col-12 col-sm-auto">
        <IgButton variant="primary" icon="add" :label="t('admin.packages.create')" @click="start" />
      </div>
    </div>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>

    <q-skeleton v-if="loading && !packages.length" height="120px" />
    <div v-else-if="!packages.length && !failed" class="ig-card">
      <EmptyState
        icon="inventory_2"
        :title="t('admin.packages.empty')"
        :hint="t('admin.packages.emptyHint')"
      />
    </div>

    <div class="row q-col-gutter-md">
      <div v-for="p in packages" :key="p.id" class="col-12 col-sm-6 col-lg-4">
        <div
          class="ig-card q-pa-lg full-height column no-wrap"
          :style="p.active ? '' : 'opacity: 0.72'"
        >
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-subtitle1 text-weight-bold ellipsis">{{ p.name }}</div>
            <span class="ig-pill" :class="p.active ? 'ig-pill--ok' : ''">
              {{ p.active ? t('admin.packages.onSale') : t('admin.packages.withdrawn') }}
            </span>
          </div>
          <div class="ig-package__credit ig-num">{{ formatMicroUsd(p.credit_micro) }}</div>
          <div class="text-h6 ig-num q-mb-md">{{ formatMinor(p.price_minor, p.currency) }}</div>
          <div class="q-mt-auto">
            <IgButton
              :variant="p.active ? 'secondary' : 'primary'"
              block
              :loading="busy === p.id"
              :label="p.active ? t('admin.packages.withdraw') : t('admin.packages.putOnSale')"
              @click="toggle(p)"
            />
          </div>
        </div>
      </div>
    </div>

    <q-dialog v-model="creating" :persistent="saving">
      <q-card
        class="ig-card ig-card--raised"
        style="width: 480px; max-width: 94vw; border-radius: 20px"
      >
        <q-form @submit.prevent="create">
          <q-card-section
            ><div class="text-h6">{{ t('admin.packages.create') }}</div></q-card-section
          >
          <q-card-section class="q-gutter-y-md">
            <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>
            <q-input
              v-model="form.name"
              autofocus
              outlined
              maxlength="80"
              :label="t('admin.packages.name')"
            />
            <q-input
              v-model="form.credit"
              outlined
              inputmode="decimal"
              :label="t('admin.packages.credit')"
            />
            <div class="row q-col-gutter-md">
              <div class="col-8">
                <q-input
                  v-model="form.price"
                  outlined
                  inputmode="decimal"
                  :label="t('admin.packages.price')"
                />
              </div>
              <div class="col-4">
                <q-input
                  v-model="form.currency"
                  outlined
                  maxlength="3"
                  :label="t('admin.packages.currency')"
                />
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md q-gutter-x-sm">
            <IgButton
              variant="ghost"
              :disable="saving"
              :label="t('common.cancel')"
              @click="creating = false"
            />
            <IgButton
              type="submit"
              variant="primary"
              :loading="saving"
              :label="t('admin.packages.create')"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>
