<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { WhatsAppTemplateInput } from '@/api/whatsapp';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import {
  emptyTemplate,
  fitExamples,
  LANGUAGES,
  LIMITS,
  preview,
  slugify,
  templateProblems,
  variablesOf,
} from '@/utils/whatsapp';

const props = defineProps<{
  saving: boolean;
  /** What the API said was wrong, when it refused. */
  error: string;
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ save: [input: WhatsAppTemplateInput] }>();
const { t } = useI18n();

const draft = ref<WhatsAppTemplateInput>(emptyTemplate());
// The name follows what is typed until the person writes their own.
const title = ref('');
const nameTouched = ref(false);
const touched = ref(false);

watch(open, (isOpen) => {
  if (!isOpen) return;
  draft.value = emptyTemplate();
  title.value = '';
  nameTouched.value = false;
  touched.value = false;
});

watch(title, (v) => {
  if (!nameTouched.value) draft.value.name = slugify(v);
});

// One example for each variable, kept as the body changes.
watch(
  () => draft.value.body,
  (body) => {
    draft.value.examples = fitExamples(body, draft.value.examples);
  },
);

const variables = computed(() => variablesOf(draft.value.body));
const found = computed(() => templateProblems(draft.value));
const valid = computed(() => Object.keys(found.value).length === 0);
const shown = computed(() => preview(draft.value.body, draft.value.examples));

function submit() {
  touched.value = true;
  if (!valid.value || props.saving) return;
  emit('save', {
    ...draft.value,
    body: draft.value.body.trim(),
    footer: draft.value.footer.trim(),
    examples: draft.value.examples.map((e) => e.trim()),
  });
}

const problem = (field: 'name' | 'body' | 'footer' | 'examples') => {
  const why = found.value[field];
  return touched.value && why
    ? t(`whatsapp.form.problem.${why}`, { v: '{{1}}', w: '{{2}}', x: '{{3}}' })
    : '';
};

const categories = computed(() => [
  { value: 'utility' as const, label: t('whatsapp.category.utility') },
  { value: 'marketing' as const, label: t('whatsapp.category.marketing') },
]);
</script>

<template>
  <q-dialog v-model="open" persistent :maximized="$q.screen.lt.md">
    <q-card
      class="ig-card ig-card--raised column no-wrap"
      :style="
        $q.screen.lt.md
          ? 'border-radius: 0; width: 100vw'
          : 'width: 880px; max-width: 94vw; max-height: 92vh; border-radius: 20px'
      "
    >
      <div class="row items-center q-px-lg q-pt-lg no-wrap">
        <div class="col text-h6">{{ t('whatsapp.form.title') }}</div>
        <IgButton
          variant="ghost"
          size="sm"
          icon-only
          icon="close"
          :aria-label="t('common.cancel')"
          :disable="saving"
          @click="open = false"
        />
      </div>

      <form
        class="col q-px-lg q-pb-lg"
        style="overflow: auto; min-height: 0"
        @submit.prevent="submit"
      >
        <p class="ig-muted q-mt-xs">{{ t('whatsapp.form.intro') }}</p>
        <div class="row q-col-gutter-lg">
          <div class="col-12 col-md-7 column q-gutter-y-md">
            <q-input
              v-model="title"
              outlined
              :label="t('whatsapp.form.nameFriendly')"
              :hint="t('whatsapp.form.nameFriendlyHint')"
            />
            <q-input
              v-model="draft.name"
              outlined
              :label="t('whatsapp.form.name')"
              :maxlength="LIMITS.name"
              :error="touched && !!found.name"
              :error-message="problem('name')"
              :hint="t('whatsapp.form.nameHint')"
              @update:model-value="nameTouched = true"
            />
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-5">
                <q-select
                  behavior="menu"
                  popup-content-class="ig-menu"
                  v-model="draft.language"
                  outlined
                  emit-value
                  :options="[...LANGUAGES]"
                  :label="t('whatsapp.form.language')"
                />
              </div>
              <div class="col-12 col-sm-7">
                <div class="text-caption ig-muted q-mb-xs">{{ t('whatsapp.form.category') }}</div>
                <div class="ig-scroll-x">
                  <IgSegmented
                    v-model="draft.category"
                    :label="t('whatsapp.form.category')"
                    :options="categories"
                  />
                </div>
                <div class="text-caption ig-muted q-mt-xs">
                  {{ t(`whatsapp.category.${draft.category}Hint`) }}
                </div>
              </div>
            </div>
            <q-input
              v-model="draft.body"
              outlined
              autogrow
              type="textarea"
              :input-style="{ minHeight: '110px' }"
              :label="t('whatsapp.form.body')"
              :error="touched && !!found.body"
              :error-message="problem('body')"
              :hint="`${draft.body.length}/${LIMITS.body} · ${t('whatsapp.form.bodyHint', { v: '{{1}}', w: '{{2}}' })}`"
            />
            <div v-if="variables.length" class="column q-gutter-y-sm">
              <div class="text-subtitle2 text-weight-bold">{{ t('whatsapp.form.examples') }}</div>
              <div class="text-caption ig-muted">{{ t('whatsapp.form.examplesHint') }}</div>
              <q-input
                v-for="(_, i) in variables"
                :key="i"
                v-model="draft.examples[i]"
                outlined
                dense
                :label="t('whatsapp.form.exampleOf', { n: i + 1 })"
                :maxlength="LIMITS.example"
                :error="touched && !!found.examples && !draft.examples[i]?.trim()"
                :error-message="problem('examples')"
              />
            </div>
            <q-input
              v-model="draft.footer"
              outlined
              :label="t('whatsapp.form.footer')"
              :maxlength="LIMITS.footer + 20"
              :error="touched && !!found.footer"
              :error-message="problem('footer')"
              :hint="t('whatsapp.form.footerHint')"
            />
          </div>

          <div class="col-12 col-md-5">
            <div class="text-caption ig-muted q-mb-xs">{{ t('whatsapp.form.preview') }}</div>
            <div class="ig-wa">
              <div class="ig-wa__bubble">
                <!-- Text on purpose: what is written here is never rendered as HTML. -->
                <div class="ig-wa__text">{{ shown || t('whatsapp.form.previewEmpty') }}</div>
                <div v-if="draft.footer.trim()" class="ig-wa__footer">{{ draft.footer }}</div>
                <div class="ig-wa__time">9:41</div>
              </div>
            </div>
            <IgAlert tone="info" class="q-mt-md">{{ t('whatsapp.form.reviewNote') }}</IgAlert>
          </div>
        </div>

        <IgAlert v-if="error" tone="error" class="q-mt-md">{{ error }}</IgAlert>

        <div class="row q-gutter-sm q-mt-md">
          <IgButton
            variant="ghost"
            :label="t('common.cancel')"
            :disable="saving"
            @click="open = false"
          />
          <IgButton
            type="submit"
            variant="primary"
            :label="t('whatsapp.form.submit')"
            :loading="saving"
          />
        </div>
      </form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.ig-wa {
  padding: 18px 14px;
  border-radius: 16px;
  background: var(--ig-surface-2, rgba(127, 127, 127, 0.1));
}
.ig-wa__bubble {
  max-width: 100%;
  padding: 8px 10px 6px;
  border-radius: 10px 10px 10px 2px;
  background: var(--ig-surface, #fff);
  border: 1px solid var(--ig-line, rgba(127, 127, 127, 0.25));
  box-shadow: 0 1px 1px rgb(0 0 0 / 8%);
}
.ig-wa__text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9rem;
  line-height: 1.45;
}
.ig-wa__footer {
  margin-top: 6px;
  font-size: 0.75rem;
  color: var(--ig-muted);
}
.ig-wa__time {
  text-align: right;
  font-size: 0.65rem;
  color: var(--ig-faint);
}
</style>
