<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ApiError } from '@/api/http';
import type { Operator } from '@/api/ops';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import { useSessionStore } from '@/stores/session';
import { isEmail } from '@/utils/validate';

const { t } = useI18n();
const $q = useQuasar();
const session = useSessionStore();

const isSuper = computed(() => session.operator?.role === 'super');
const me = computed(() => session.operator?.id);

const operators = ref<Operator[]>([]);
const loading = ref(true);
const failed = ref(false);

const when = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso));

async function load() {
  if (!isSuper.value) return void (loading.value = false);
  loading.value = true;
  failed.value = false;
  try {
    operators.value = (await session.ops.operators()).items;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

// --- invite -----------------------------------------------------------------
const inviting = ref(false);
const saving = ref(false);
const error = ref('');
const form = ref<{ email: string; name: string; role: 'super' | 'staff' }>({
  email: '',
  name: '',
  role: 'staff',
});

function startInvite() {
  form.value = { email: '', name: '', role: 'staff' };
  error.value = '';
  inviting.value = true;
}

async function invite() {
  error.value = '';
  if (!form.value.name.trim()) return void (error.value = t('auth.errors.required'));
  if (!isEmail(form.value.email)) return void (error.value = t('auth.errors.email'));
  saving.value = true;
  try {
    const op = await session.ops.inviteOperator({
      email: form.value.email.trim(),
      name: form.value.name.trim(),
      role: form.value.role,
    });
    operators.value = [op, ...operators.value];
    inviting.value = false;
    $q.notify({ type: 'positive', message: t('admin.operators.invited') });
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 409
        ? t('admin.tenants.new.conflict')
        : t('common.loadError');
  } finally {
    saving.value = false;
  }
}

// --- disable / enable and reset the second factor ------------------------------
type Pending = { kind: 'disable' | 'reset'; op: Operator } | null;
const pending = ref<Pending>(null);
const confirmOpen = computed({
  get: () => pending.value !== null,
  set: (v) => {
    if (!v) pending.value = null;
  },
});
const working = ref(false);

async function enable(op: Operator) {
  try {
    await session.ops.setOperatorStatus(op.id, 'active');
    operators.value = operators.value.map((x) => (x.id === op.id ? { ...x, status: 'active' } : x));
    $q.notify({ type: 'positive', message: t('admin.operators.done') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  }
}

async function confirm() {
  const p = pending.value;
  if (!p) return;
  working.value = true;
  try {
    if (p.kind === 'disable') {
      await session.ops.setOperatorStatus(p.op.id, 'disabled');
      operators.value = operators.value.map((x) =>
        x.id === p.op.id ? { ...x, status: 'disabled' } : x,
      );
    } else {
      await session.ops.resetOperatorMfa(p.op.id);
      operators.value = operators.value.map((x) =>
        x.id === p.op.id ? { ...x, mfa_enabled: false } : x,
      );
    }
    pending.value = null;
    $q.notify({ type: 'positive', message: t('admin.operators.done') });
  } catch {
    $q.notify({ type: 'negative', message: t('common.loadError') });
  } finally {
    working.value = false;
  }
}
</script>

<template>
  <q-page padding>
    <div class="row items-end justify-between q-mb-lg q-col-gutter-md">
      <div class="col-12 col-sm">
        <div class="ig-eyebrow q-mb-xs">{{ t('admin.nav.operators') }}</div>
        <h1 class="text-h4 q-my-none">{{ t('admin.operators.title') }}</h1>
        <p class="ig-muted q-mt-sm q-mb-none">{{ t('admin.operators.intro') }}</p>
      </div>
      <div v-if="isSuper" class="col-12 col-sm-auto">
        <IgButton
          variant="primary"
          icon="person_add"
          :label="t('admin.operators.invite')"
          @click="startInvite"
        />
      </div>
    </div>

    <IgAlert v-if="!isSuper" tone="info">{{ t('admin.operators.onlySuper') }}</IgAlert>

    <template v-else>
      <IgAlert v-if="failed" tone="error" class="q-mb-md">
        {{ t('common.loadError') }}
        <template #action>
          <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
        </template>
      </IgAlert>

      <div class="ig-card" style="overflow: hidden">
        <q-skeleton v-if="loading && !operators.length" height="64px" class="q-ma-md" />
        <EmptyState
          v-else-if="!operators.length"
          icon="groups"
          :title="t('admin.operators.title')"
        />
        <div v-for="o in operators" :key="o.id" class="ig-row" style="cursor: default">
          <span class="ig-avatar">{{ o.name.charAt(0).toUpperCase() }}</span>
          <div class="col" style="min-width: 0">
            <div class="text-weight-bold ellipsis">
              {{ o.name }}
              <span v-if="o.id === me" class="ig-pill ig-pill--brand q-ml-xs">{{
                t('admin.operators.you')
              }}</span>
            </div>
            <div class="text-caption ig-muted ellipsis">
              {{ o.email }} · {{ when(o.created_at) }}
            </div>
            <div class="row q-gutter-xs q-mt-xs">
              <span class="ig-pill ig-pill--brand">{{ t(`admin.roles.${o.role}`) }}</span>
              <span
                class="ig-pill"
                :class="o.status === 'active' ? 'ig-pill--ok' : 'ig-pill--warn'"
              >
                {{ t(`admin.operators.status.${o.status}`) }}
              </span>
              <span class="ig-pill">{{
                o.mfa_enabled ? t('admin.operators.mfaOn') : t('admin.operators.mfaOff')
              }}</span>
            </div>
          </div>
          <IgButton
            v-if="o.id !== me"
            variant="ghost"
            icon-only
            icon="more_vert"
            :label="t('common.menu')"
          >
            <q-menu anchor="bottom right" self="top right" class="ig-menu">
              <q-list padding style="min-width: 240px">
                <q-item
                  v-close-popup
                  clickable
                  @click="
                    o.status === 'active' ? (pending = { kind: 'disable', op: o }) : enable(o)
                  "
                >
                  <q-item-section avatar style="min-width: 36px">
                    <q-icon :name="o.status === 'active' ? 'block' : 'check_circle'" />
                  </q-item-section>
                  <q-item-section>
                    {{
                      o.status === 'active'
                        ? t('admin.operators.disable')
                        : t('admin.operators.enable')
                    }}
                  </q-item-section>
                </q-item>
                <q-item
                  v-close-popup
                  clickable
                  :disable="!o.mfa_enabled"
                  @click="pending = { kind: 'reset', op: o }"
                >
                  <q-item-section avatar style="min-width: 36px"
                    ><q-icon name="phonelink_erase"
                  /></q-item-section>
                  <q-item-section>{{ t('admin.operators.resetMfa') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </IgButton>
        </div>
      </div>
    </template>

    <q-dialog v-model="inviting" :persistent="saving">
      <q-card
        class="ig-card ig-card--raised"
        style="width: 480px; max-width: 94vw; border-radius: 20px"
      >
        <q-form autocomplete="off" @submit.prevent="invite">
          <q-card-section>
            <div class="text-h6">{{ t('admin.operators.invite') }}</div>
            <p class="ig-muted text-body2 q-mt-sm q-mb-none">
              {{ t('admin.operators.inviteNote') }}
            </p>
          </q-card-section>
          <q-card-section class="q-gutter-y-md">
            <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>
            <q-input v-model="form.name" autofocus outlined :label="t('admin.operators.name')" />
            <q-input
              v-model="form.email"
              outlined
              type="email"
              autocomplete="off"
              :label="t('admin.operators.email')"
            />
            <IgSegmented
              v-model="form.role"
              block
              :label="t('admin.operators.role')"
              :options="[
                { value: 'staff', label: t('admin.roles.staff') },
                { value: 'super', label: t('admin.roles.super') },
              ]"
            />
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md q-gutter-x-sm">
            <IgButton
              variant="ghost"
              :disable="saving"
              :label="t('common.cancel')"
              @click="inviting = false"
            />
            <IgButton
              type="submit"
              variant="primary"
              :loading="saving"
              :label="t('admin.operators.invite')"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <ConfirmDialog
      v-model="confirmOpen"
      destructive
      :loading="working"
      :title="
        pending?.kind === 'reset'
          ? t('admin.operators.resetTitle')
          : t('admin.operators.disableTitle')
      "
      :message="`${pending?.op.name ?? ''}\n${pending?.kind === 'reset' ? t('admin.operators.resetBody') : t('admin.operators.disableBody')}`"
      :confirm-label="
        pending?.kind === 'reset' ? t('admin.operators.resetMfa') : t('admin.operators.disable')
      "
      :cancel-label="t('common.cancel')"
      @confirm="confirm"
    />
  </q-page>
</template>
