<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { AssistantClient, AssistantProfile } from '@/api/assistant';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import {
  draftFrom,
  emptyDraft,
  LIMITS,
  problems,
  sameProfile,
  TONES,
  toInput,
  type ProfileDraft,
  type ProfileField,
} from '@/utils/assistant';

const props = defineProps<{ client: AssistantClient }>();
const { t } = useI18n();
const $q = useQuasar();

const saved = ref<AssistantProfile | null>(null);
const draft = ref<ProfileDraft>(emptyDraft());
const failed = ref(false);
const saving = ref(false);
const previewing = ref(false);
const preview = ref<string | null>(null);
const resetOpen = ref(false);

const variables = computed(() => saved.value?.variables ?? ['business_name', 'language']);
const found = computed(() => problems(draft.value, variables.value));
const valid = computed(() => Object.keys(found.value).length === 0);
const dirty = computed(() => !saved.value || !sameProfile(saved.value, toInput(draft.value)));

function show(p: AssistantProfile) {
  saved.value = p;
  draft.value = draftFrom(p);
  preview.value = null;
}

async function load() {
  failed.value = false;
  try {
    show(await props.client.get());
  } catch {
    failed.value = true;
  }
}
onMounted(load);

async function save() {
  if (!valid.value || saving.value) return;
  saving.value = true;
  try {
    show(await props.client.save(toInput(draft.value)));
    $q.notify({ type: 'positive', message: t('assistant.saved') });
  } catch {
    $q.notify({ type: 'negative', message: t('assistant.refused') });
  } finally {
    saving.value = false;
  }
}

async function reset() {
  saving.value = true;
  try {
    show(await props.client.save(toInput(emptyDraft())));
    resetOpen.value = false;
    $q.notify({ type: 'positive', message: t('assistant.resetDone') });
  } catch {
    $q.notify({ type: 'negative', message: t('assistant.refused') });
  } finally {
    saving.value = false;
  }
}

async function showPreview() {
  if (!valid.value) return;
  previewing.value = true;
  try {
    preview.value = (await props.client.preview(toInput(draft.value))).prompt;
  } catch {
    $q.notify({ type: 'negative', message: t('assistant.refused') });
  } finally {
    previewing.value = false;
  }
}

const hint = (field: ProfileField, max: number, text: string) => {
  const why = found.value[field];
  if (why === 'placeholder') return t('assistant.errors.placeholder', { list: variableList() });
  if (why === 'long') return t('assistant.errors.long', { max });
  if (why === 'many') return t('assistant.errors.many', { max: LIMITS.rules });
  if (why === 'longRule') return t('assistant.errors.longRule', { max: LIMITS.rule });
  return text;
};
const variableList = () => variables.value.map((v) => `{{${v}}}`).join(', ');
const toneOptions = computed(() => [
  { value: '', label: t('assistant.tone.none') },
  ...TONES.map((x) => ({ value: x, label: t(`assistant.tone.${x}`) })),
]);
</script>

<template>
  <div>
    <IgAlert v-if="failed" tone="error" class="q-mb-md">
      {{ t('common.loadError') }}
      <template #action>
        <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
      </template>
    </IgAlert>
    <q-skeleton v-else-if="!saved" height="320px" />

    <form v-else class="ig-profile column q-gutter-y-md" @submit.prevent="save">
      <IgAlert v-if="saved.is_default" tone="info">{{ t('assistant.defaultNote') }}</IgAlert>

      <section class="ig-card q-pa-lg column q-gutter-y-md">
        <div>
          <div class="text-h6">{{ t('assistant.business.title') }}</div>
          <p class="ig-muted q-mt-xs q-mb-none">{{ t('assistant.business.intro') }}</p>
        </div>
        <q-input
          v-model="draft.businessName"
          outlined
          :label="t('assistant.business.name')"
          :maxlength="LIMITS.businessName + 20"
          :error="!!found.businessName"
          :error-message="hint('businessName', LIMITS.businessName, '')"
          :hint="t('assistant.business.nameHint')"
        />
        <q-input
          v-model="draft.about"
          outlined
          autogrow
          type="textarea"
          :input-style="{ minHeight: '110px' }"
          :label="t('assistant.business.about')"
          :error="!!found.about"
          :error-message="hint('about', LIMITS.about, '')"
          :hint="`${draft.about.length}/${LIMITS.about} · ${t('assistant.business.aboutHint')}`"
        />
      </section>

      <section class="ig-card q-pa-lg column q-gutter-y-md">
        <div>
          <div class="text-h6">{{ t('assistant.voice.title') }}</div>
          <p class="ig-muted q-mt-xs q-mb-none">{{ t('assistant.voice.intro') }}</p>
        </div>
        <div>
          <div class="text-caption ig-muted q-mb-xs">{{ t('assistant.tone.label') }}</div>
          <div class="ig-scroll-x">
            <IgSegmented
              v-model="draft.tone"
              :label="t('assistant.tone.label')"
              :options="toneOptions"
            />
          </div>
          <div class="text-caption ig-muted q-mt-xs">
            {{ draft.tone ? t(`assistant.tone.${draft.tone}Hint`) : t('assistant.tone.noneHint') }}
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-5">
            <q-input
              v-model="draft.language"
              outlined
              :label="t('assistant.voice.language')"
              :error="!!found.language"
              :error-message="hint('language', LIMITS.language, '')"
              :hint="t('assistant.voice.languageHint')"
            />
          </div>
          <div class="col-12 col-sm-7">
            <q-input
              v-model="draft.greeting"
              outlined
              autogrow
              type="textarea"
              :label="t('assistant.voice.greeting')"
              :error="!!found.greeting"
              :error-message="hint('greeting', LIMITS.greeting, '')"
              :hint="t('assistant.voice.greetingHint', { v: '{{business_name}}' })"
            />
          </div>
        </div>
      </section>

      <section class="ig-card q-pa-lg column q-gutter-y-md">
        <div>
          <div class="text-h6">{{ t('assistant.rules.title') }}</div>
          <p class="ig-muted q-mt-xs q-mb-none">{{ t('assistant.rules.intro') }}</p>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <q-input
              v-model="draft.always"
              outlined
              autogrow
              type="textarea"
              :input-style="{ minHeight: '90px' }"
              :label="t('assistant.rules.always')"
              :placeholder="t('assistant.rules.alwaysExample')"
              :error="!!found.always"
              :error-message="hint('always', LIMITS.rule, '')"
              :hint="t('assistant.rules.hint', { max: LIMITS.rules })"
            />
          </div>
          <div class="col-12 col-md-6">
            <q-input
              v-model="draft.never"
              outlined
              autogrow
              type="textarea"
              :input-style="{ minHeight: '90px' }"
              :label="t('assistant.rules.never')"
              :placeholder="t('assistant.rules.neverExample')"
              :error="!!found.never"
              :error-message="hint('never', LIMITS.rule, '')"
              :hint="t('assistant.rules.hint', { max: LIMITS.rules })"
            />
          </div>
        </div>
        <q-expansion-item
          dense
          :label="t('assistant.extra.title')"
          :default-opened="!!draft.extra"
          header-class="text-weight-medium"
        >
          <q-input
            v-model="draft.extra"
            outlined
            autogrow
            type="textarea"
            class="q-mt-sm"
            :input-style="{ minHeight: '90px' }"
            :label="t('assistant.extra.label')"
            :error="!!found.extra"
            :error-message="hint('extra', LIMITS.extra, '')"
            :hint="`${draft.extra.length}/${LIMITS.extra} · ${t('assistant.extra.hint')}`"
          />
        </q-expansion-item>
        <div class="text-caption ig-muted">
          {{ t('assistant.variables', { list: variableList() }) }}
        </div>
      </section>

      <section class="ig-card q-pa-lg column q-gutter-y-sm">
        <div>
          <div class="text-h6">{{ t('assistant.preview.title') }}</div>
          <p class="ig-muted q-mt-xs q-mb-none">{{ t('assistant.preview.intro') }}</p>
        </div>
        <div>
          <IgButton
            variant="secondary"
            size="sm"
            icon="visibility"
            :label="t('assistant.preview.show')"
            :loading="previewing"
            :disable="!valid"
            @click="showPreview"
          />
        </div>
        <!-- Text on purpose: it is rendered as it is, never as HTML. -->
        <pre v-if="preview !== null" class="ig-prompt">{{ preview }}</pre>
      </section>

      <div class="row items-center q-gutter-sm">
        <IgButton
          type="submit"
          variant="primary"
          :label="t('assistant.save')"
          :loading="saving"
          :disable="!valid || !dirty"
        />
        <IgButton
          variant="ghost"
          :label="t('assistant.reset')"
          :disable="saved.is_default || saving"
          @click="resetOpen = true"
        />
        <span v-if="dirty && valid" class="text-caption ig-muted">{{
          t('assistant.unsaved')
        }}</span>
      </div>
    </form>

    <ConfirmDialog
      v-model="resetOpen"
      destructive
      :loading="saving"
      :title="t('assistant.resetTitle')"
      :message="t('assistant.resetBody')"
      :confirm-label="t('assistant.reset')"
      :cancel-label="t('common.cancel')"
      @confirm="reset"
    />
  </div>
</template>

<style scoped>
/* A flex child does not shrink below its content: the tone options would stretch the card on a phone. */
.ig-profile,
.ig-profile > section,
.ig-profile > section > div {
  min-width: 0;
  max-width: 100%;
}
.ig-prompt {
  margin: 0;
  padding: 16px;
  border-radius: 12px;
  background: var(--ig-surface-2, rgba(127, 127, 127, 0.1));
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.55;
  max-height: 360px;
  overflow: auto;
}
</style>
