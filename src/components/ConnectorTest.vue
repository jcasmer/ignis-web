<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Connector, ConnectorTestResult } from '@/api/tenant';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import { useSessionStore } from '@/stores/session';
import { argumentsTemplate, failureText, toolName } from '@/utils/connectors';

const props = defineProps<{
  tenantId: string;
  connector: Connector;
  operation: Connector['operations'][number];
}>();

const { t } = useI18n();
const session = useSessionStore();
const open = defineModel<boolean>({ required: true });

const args = ref('');
const running = ref(false);
const error = ref('');
const result = ref<ConnectorTestResult | null>(null);

watch(
  open,
  (v) => {
    if (!v) return;
    args.value = argumentsTemplate(props.operation.params);
    error.value = '';
    result.value = null;
  },
  { immediate: true },
);

async function run() {
  error.value = '';
  result.value = null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.value.trim() || '{}');
  } catch {
    error.value = t('admin.tenant.connectors.test.badJson');
    return;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    error.value = t('admin.tenant.connectors.test.badJson');
    return;
  }
  running.value = true;
  try {
    result.value = await session.ops.testConnector(props.tenantId, props.connector.name, {
      operation: props.operation.name,
      arguments: parsed,
    });
  } catch (e) {
    // A 400 is the API saying the arguments do not fit the operation.
    error.value =
      (e as { status?: number }).status === 400
        ? t('admin.tenant.connectors.test.rejected')
        : t('admin.tenant.connectors.test.error');
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <q-dialog v-model="open" :persistent="running" :maximized="$q.screen.lt.sm">
    <q-card
      class="ig-card ig-card--raised column no-wrap"
      :style="
        $q.screen.lt.sm
          ? 'border-radius: 0'
          : 'width: 640px; max-width: 94vw; max-height: 90vh; border-radius: 20px'
      "
    >
      <q-card-section>
        <div class="text-h6">
          {{
            t('admin.tenant.connectors.test.title', {
              tool: toolName(connector.name, operation.name),
            })
          }}
        </div>
        <div class="text-caption ig-muted">{{ t('admin.tenant.connectors.test.hint') }}</div>
      </q-card-section>

      <q-card-section class="col q-gutter-y-md" style="overflow-y: auto; min-height: 0">
        <IgAlert tone="info">{{ t('admin.tenant.connectors.test.privacy') }}</IgAlert>
        <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>

        <q-input
          v-model="args"
          outlined
          type="textarea"
          :rows="6"
          spellcheck="false"
          :label="t('admin.tenant.connectors.test.args')"
          input-style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px"
        />

        <template v-if="result">
          <div class="row items-center q-gutter-x-sm">
            <span class="ig-pill" :class="result.ok ? 'ig-pill--ok' : 'ig-pill--warn'">
              {{
                result.ok
                  ? t('admin.tenant.connectors.test.ok')
                  : t('admin.tenant.connectors.test.failed')
              }}
            </span>
            <span class="text-caption ig-muted">
              {{ t('admin.tenant.connectors.test.duration', { ms: result.duration_ms }) }}
            </span>
          </div>
          <!-- Text on purpose: it is what another system answered, never rendered as HTML. -->
          <pre
            v-if="result.ok"
            class="ig-card q-pa-md q-my-none"
            style="
              white-space: pre-wrap;
              word-break: break-word;
              max-height: 280px;
              overflow: auto;
              font-size: 13px;
            "
            >{{ result.output || t('admin.tenant.connectors.test.noOutput') }}</pre>
          <IgAlert v-else tone="warn">{{ failureText(result.message ?? '') }}</IgAlert>
          <div v-if="result.truncated" class="text-caption ig-muted">
            {{ t('admin.tenant.connectors.test.truncated') }}
          </div>
        </template>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md q-gutter-x-sm">
        <IgButton
          variant="ghost"
          :disable="running"
          :label="t('common.cancel')"
          @click="open = false"
        />
        <IgButton
          variant="primary"
          icon="play_arrow"
          :loading="running"
          :label="t('admin.tenant.connectors.test.run')"
          @click="run"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
