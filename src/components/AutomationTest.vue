<script setup lang="ts">
import { inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { AutomationInput, AutomationSampleEvent, AutomationTrace } from '@/api/automations';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';

const props = defineProps<{
  /** Builds the rule from the form; the error says what is wrong with it. */
  build: () => { input?: AutomationInput; error?: string };
  trigger: 'message_received' | 'schedule';
  test: (rule: AutomationInput, event: AutomationSampleEvent) => Promise<AutomationTrace>;
}>();
const { t } = useI18n();
const operator = inject('automationsOperatorView', false);

const text = ref('Hola, ¿cuál es el horario?');
const channel = ref('whatsapp');
const name = ref('Ana');
const isNew = ref(true);
const at = ref('');

const running = ref(false);
const error = ref('');
const trace = ref<AutomationTrace | null>(null);

async function run() {
  error.value = '';
  trace.value = null;
  const built = props.build();
  if (!built.input) {
    error.value = built.error ?? '';
    return;
  }
  const event: AutomationSampleEvent = {};
  if (props.trigger === 'message_received') {
    event.message = { text: text.value, channel: channel.value };
    event.contact = { name: name.value, channel: channel.value, is_new: isNew.value };
  }
  if (at.value) event.at = new Date(at.value).toISOString();
  running.value = true;
  try {
    trace.value = await props.test(built.input, event);
  } catch (e) {
    const code = (e as { code?: string }).code;
    error.value =
      code === 'module_not_included'
        ? operator
          ? t('admin.tenant.automationsOff.ai')
          : t('tenant.automations.notIncludedAi')
        : t('tenant.automations.test.failed');
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <div class="column q-gutter-y-sm">
    <div class="text-caption ig-muted">{{ t('tenant.automations.test.hint') }}</div>

    <template v-if="trigger === 'message_received'">
      <q-input
        v-model="text"
        dense
        outlined
        maxlength="1000"
        :label="t('tenant.automations.test.message')"
      />
      <div class="row q-col-gutter-sm items-center">
        <div class="col-12 col-sm-4">
          <q-input
            v-model="name"
            dense
            outlined
            maxlength="80"
            :label="t('tenant.automations.test.name')"
          />
        </div>
        <div class="col-6 col-sm-4">
          <q-select
            behavior="menu"
            popup-content-class="ig-menu"
            v-model="channel"
            dense
            outlined
            :options="['whatsapp', 'instagram', 'facebook']"
            :label="t('tenant.automations.test.channel')"
          />
        </div>
        <div class="col-6 col-sm-4">
          <q-toggle v-model="isNew" :label="t('tenant.automations.test.isNew')" />
        </div>
      </div>
    </template>
    <q-input
      v-model="at"
      dense
      outlined
      type="datetime-local"
      :label="t('tenant.automations.test.at')"
      :hint="t('tenant.automations.test.atHint')"
    />

    <div>
      <IgButton
        variant="primary"
        icon="play_arrow"
        :loading="running"
        :label="t('tenant.automations.test.run')"
        @click="run"
      />
    </div>

    <IgAlert v-if="error" tone="error">{{ error }}</IgAlert>

    <div v-if="trace" class="column q-gutter-y-sm">
      <div class="row items-center q-gutter-x-sm">
        <span class="ig-pill" :class="trace.matched ? 'ig-pill--ok' : 'ig-pill--warn'">
          {{
            trace.matched
              ? t('tenant.automations.test.wouldAct')
              : t('tenant.automations.test.wouldNot')
          }}
        </span>
        <span class="text-caption ig-muted">{{ t('tenant.automations.test.nothingSent') }}</span>
      </div>

      <div v-for="c in trace.conditions" :key="c.condition" class="row items-center no-wrap">
        <q-icon
          :name="c.passed ? 'check_circle' : 'cancel'"
          size="18px"
          :color="c.passed ? 'positive' : 'grey-6'"
          class="q-mr-sm"
        />
        <code class="text-caption">{{ c.condition }}</code>
      </div>

      <template v-if="trace.matched">
        <div class="ig-eyebrow">{{ t('tenant.automations.test.wouldDo') }}</div>
        <div v-for="(a, i) in trace.actions" :key="i" class="ig-card q-pa-sm">
          <div class="text-caption text-weight-bold">
            {{ i + 1 }}. {{ t(`tenant.automations.step.${a.type}.name`) }}
          </div>
          <!-- Text on purpose: it carries what a contact could write. -->
          <div style="white-space: pre-wrap; word-break: break-word">{{ a.detail }}</div>
        </div>
      </template>
    </div>
  </div>
</template>
