<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import type { TenantListItem } from '@/api/ops';
import AuditLog from '@/components/AuditLog.vue';
import { useSessionStore } from '@/stores/session';

const { t } = useI18n();
const route = useRoute();
const session = useSessionStore();

// The Ignis team reads the whole platform; a business reads what was done in its own account.
const ops = computed(() => route.path.startsWith('/admin'));
const client = computed(() => (ops.value ? session.ops.audit : session.data.audit));

const tenants = ref<TenantListItem[]>([]);
onMounted(async () => {
  if (!ops.value) return;
  try {
    tenants.value = (await session.ops.tenants({ limit: 200 })).items;
  } catch {
    // The log still works: only the name of the client is missing.
  }
});
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t(ops ? 'admin.nav.audit' : 'tenant.nav.audit') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('audit.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t(ops ? 'audit.introOps' : 'audit.intro') }}</p>
    </div>
    <AuditLog :client="client" :operator="ops" :tenants="tenants" />
  </q-page>
</template>
