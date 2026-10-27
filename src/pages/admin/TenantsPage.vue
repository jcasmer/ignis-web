<script setup lang="ts">
import { copyToClipboard, useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ApiError } from '@/api/http';
import type { Catalog, Plan, TenantListItem } from '@/api/ops';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { useSessionStore } from '@/stores/session';
import { formatMinor } from '@/utils/format';
import { generatePassword, SLUG_PATTERN, slugify } from '@/utils/plan';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const tenants = ref<TenantListItem[]>([]);
const cursor = ref<string | undefined>();
const catalog = ref<Catalog | null>(null);
const plans = ref<Plan[]>([]);
const loading = ref(true);
const failed = ref(false);
const search = ref('');

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso));

async function load(more = false) {
  loading.value = true;
  failed.value = false;
  try {
    const page = await session.ops.tenants(more && cursor.value ? { cursor: cursor.value } : {});
    tenants.value = more ? [...tenants.value, ...page.items] : page.items;
    cursor.value = page.next_cursor;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  void load();
  try {
    catalog.value = await session.ops.catalog();
    plans.value = (await session.ops.plans()).items.filter((p) => p.active);
  } catch {
    // The form still works without the module list: it then uses all of them.
  }
});

const shown = computed(() => {
  const q = search.value.trim().toLowerCase();
  return q
    ? tenants.value.filter((x) => x.name.toLowerCase().includes(q) || x.slug.includes(q))
    : tenants.value;
});

// --- new tenant ------------------------------------------------------------
const creating = ref(false);
const saving = ref(false);
const error = ref('');
const form = ref({
  name: '',
  slug: '',
  email: '',
  password: '',
  modules: [] as string[],
  allModules: true,
  planId: '',
});
const slugTouched = ref(false);

function startCreate() {
  form.value = {
    name: '',
    slug: '',
    email: '',
    password: generatePassword(),
    modules: [],
    allModules: true,
    planId: '',
  };
  slugTouched.value = false;
  error.value = '';
  creating.value = true;
}

function onName(v: string | number | null) {
  form.value.name = String(v ?? '');
  if (!slugTouched.value) form.value.slug = slugify(form.value.name);
}

async function copyPassword() {
  await copyToClipboard(form.value.password);
  $q.notify({ type: 'positive', message: t('common.copied'), timeout: 1500 });
}

async function create() {
  error.value = '';
  const f = form.value;
  if (!f.name.trim() || !f.email.trim() || !f.password)
    return void (error.value = t('auth.errors.required'));
  if (!SLUG_PATTERN.test(f.slug)) return void (error.value = t('admin.tenants.new.slugInvalid'));
  saving.value = true;
  try {
    await session.ops.createTenant({
      slug: f.slug,
      name: f.name.trim(),
      owner_email: f.email.trim(),
      owner_password: f.password,
      ...(f.planId ? { plan_id: f.planId } : !f.allModules && { modules: f.modules }),
    });
    creating.value = false;
    form.value.password = '';
    $q.notify({ type: 'positive', message: t('admin.tenants.new.created') });
    await load();
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 409
        ? t('admin.tenants.new.conflict')
        : e instanceof ApiError && e.status === 400
          ? t('admin.tenants.new.invalid')
          : t('common.loadError');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <q-page padding>
    <div class="row items-end justify-between q-mb-lg q-col-gutter-md">
      <div class="col-12 col-sm">
        <div class="ig-eyebrow q-mb-xs">{{ t('admin.nav.tenants') }}</div>
        <h1 class="text-h4 q-my-none">{{ t('admin.tenants.title') }}</h1>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('admin.tenants.intro') }}</p>
      </div>
      <div class="col-12 col-sm-auto">
        <IgButton
          variant="primary"
          icon="add"
          :label="t('admin.tenants.create')"
          @click="startCreate"
        />
      </div>
    </div>

    <q-input
      v-model="search"
      outlined
      clearable
      class="q-mb-md"
      :label="t('admin.tenants.search')"
      style="max-width: 420px"
    >
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load()" />
      </template>
    </IgAlert>

    <div class="ig-card" style="overflow: hidden">
      <q-skeleton v-if="loading && !tenants.length" height="64px" class="q-ma-md" />
      <EmptyState v-else-if="!tenants.length" icon="domain" :title="t('admin.tenants.empty')" />
      <EmptyState v-else-if="!shown.length" icon="search_off" :title="t('admin.tenants.noMatch')" />
      <router-link
        v-for="x in shown"
        :key="x.id"
        :to="`/admin/tenants/${x.id}`"
        class="ig-row"
        style="text-decoration: none; color: inherit"
      >
        <span class="ig-avatar">{{ x.name.charAt(0).toUpperCase() }}</span>
        <div class="col" style="min-width: 0">
          <div class="text-weight-bold ellipsis">{{ x.name }}</div>
          <div class="text-caption ig-muted ellipsis">
            {{ x.slug }} · {{ x.modules.length }} {{ t('admin.tenants.modules') }} ·
            {{ t(`admin.tenants.profile.${x.model_profile}`) }} · {{ when(x.created_at) }}
          </div>
        </div>
        <span class="ig-pill" :class="x.status === 'active' ? 'ig-pill--ok' : 'ig-pill--warn'">
          {{ t(`admin.tenants.status.${x.status}`) }}
        </span>
        <q-icon name="chevron_right" class="ig-muted" />
      </router-link>
      <div v-if="cursor" class="q-pa-sm text-center">
        <IgButton
          variant="ghost"
          size="sm"
          :loading="loading"
          :label="t('admin.tenants.loadMore')"
          @click="load(true)"
        />
      </div>
    </div>

    <q-dialog v-model="creating" :persistent="saving">
      <q-card
        class="ig-card ig-card--raised"
        style="width: 560px; max-width: 94vw; border-radius: 20px"
      >
        <q-form autocomplete="off" @submit.prevent="create">
          <q-card-section>
            <div class="text-h6">{{ t('admin.tenants.new.title') }}</div>
          </q-card-section>
          <q-card-section class="q-gutter-y-md" style="max-height: 68vh; overflow-y: auto">
            <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>
            <q-input
              :model-value="form.name"
              outlined
              autofocus
              :label="t('admin.tenants.new.name')"
              @update:model-value="onName"
            />
            <q-input
              v-model="form.slug"
              outlined
              :label="t('admin.tenants.new.slug')"
              :hint="t('admin.tenants.new.slugHint')"
              @update:model-value="slugTouched = true"
            />
            <q-input
              v-model="form.email"
              outlined
              type="email"
              autocomplete="off"
              :label="t('admin.tenants.new.email')"
            />
            <q-input
              v-model="form.password"
              outlined
              autocomplete="new-password"
              :label="t('admin.tenants.new.password')"
              :hint="t('admin.tenants.new.passwordHint')"
              input-class="ig-code"
            >
              <template #append>
                <IgButton
                  variant="ghost"
                  size="sm"
                  icon="refresh"
                  :label="t('admin.tenants.new.generate')"
                  @click="form.password = generatePassword()"
                />
                <IgButton
                  variant="ghost"
                  size="sm"
                  icon="content_copy"
                  :label="t('admin.tenants.new.copy')"
                  @click="copyPassword"
                />
              </template>
            </q-input>

            <div v-if="plans.length">
              <div class="ig-eyebrow q-mb-xs">{{ t('admin.tenants.new.plan') }}</div>
              <q-select
                v-model="form.planId"
                outlined
                dense
                emit-value
                map-options
                :options="[
                  { label: t('admin.tenants.new.noPlan'), value: '' },
                  ...plans.map((p) => ({
                    label: `${p.name} · ${formatMinor(p.price_minor, p.currency)}`,
                    value: p.id,
                  })),
                ]"
              />
              <div class="text-caption ig-muted q-mt-xs">{{ t('admin.tenants.new.planHint') }}</div>
            </div>

            <div v-if="!form.planId">
              <div class="ig-eyebrow q-mb-xs">{{ t('admin.tenants.new.modules') }}</div>
              <q-toggle
                v-model="form.allModules"
                :label="t('admin.tenants.new.allModules')"
                color="primary"
              />
              <div v-if="!form.allModules && catalog" class="column">
                <q-checkbox
                  v-for="m in catalog.modules"
                  :key="m.id"
                  v-model="form.modules"
                  :val="m.id"
                  :label="m.id"
                  color="primary"
                >
                  <q-tooltip>{{ m.description }}</q-tooltip>
                </q-checkbox>
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
              :label="t('admin.tenants.create')"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>
