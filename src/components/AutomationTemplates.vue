<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { AutomationRule, AutomationsClient, AutomationTemplate } from '@/api/automations';
import IgAlert from '@/components/IgAlert.vue';
import IgButton from '@/components/IgButton.vue';
import IgSegmented from '@/components/IgSegmented.vue';
import { answerProblems, CATEGORIES, defaultAnswers, inCategory } from '@/utils/templates';

const props = defineProps<{ client: AutomationsClient }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ build: [rule: AutomationRule] }>();
const { t } = useI18n();

const items = ref<AutomationTemplate[]>([]);
const loaded = ref(false);
const failed = ref(false);
const category = ref<AutomationTemplate['category'] | 'all'>('all');
const chosen = ref<AutomationTemplate | null>(null);
const answers = ref<Record<string, string>>({});
const building = ref(false);
const refused = ref(false);
const touched = ref(false);

async function load() {
  failed.value = false;
  try {
    items.value = (await props.client.templates()).items;
    loaded.value = true;
  } catch {
    failed.value = true;
  }
}

// Every opening starts from the gallery, with the catalog read again.
watch(open, (isOpen) => {
  if (!isOpen) return;
  chosen.value = null;
  refused.value = false;
  touched.value = false;
  void load();
});

const shown = computed(() => inCategory(items.value, category.value));
const problems = computed(() => (chosen.value ? answerProblems(chosen.value, answers.value) : {}));

function choose(tpl: AutomationTemplate) {
  chosen.value = tpl;
  answers.value = defaultAnswers(tpl);
  refused.value = false;
  touched.value = false;
}

async function build() {
  const tpl = chosen.value;
  touched.value = true;
  if (!tpl || Object.keys(problems.value).length) return;
  building.value = true;
  refused.value = false;
  try {
    emit('build', await props.client.buildTemplate(tpl.id, answers.value));
  } catch {
    refused.value = true;
  } finally {
    building.value = false;
  }
}

const problemText = (id: string) => {
  const why = problems.value[id];
  return touched.value && why ? t(`tenant.automations.templates.problem.${why}`) : '';
};
</script>

<template>
  <q-dialog v-model="open" :maximized="$q.screen.lt.md">
    <q-card
      class="ig-card ig-card--raised column no-wrap"
      :style="
        $q.screen.lt.md
          ? 'border-radius: 0; width: 100vw'
          : 'width: 860px; max-width: 94vw; max-height: 90vh; border-radius: 20px'
      "
    >
      <div class="row items-center q-px-lg q-pt-lg no-wrap">
        <div class="col text-h6">
          {{ chosen ? chosen.name : t('tenant.automations.templates.title') }}
        </div>
        <IgButton
          variant="ghost"
          size="sm"
          icon-only
          icon="close"
          :aria-label="t('tenant.automations.templates.close')"
          @click="open = false"
        />
      </div>

      <div class="q-px-lg q-pb-lg col" style="overflow: auto; min-height: 0">
        <!-- The gallery -->
        <template v-if="!chosen">
          <p class="ig-muted q-mt-xs">{{ t('tenant.automations.templates.intro') }}</p>
          <div class="ig-scroll-x q-mb-md">
            <IgSegmented
              v-model="category"
              :label="t('tenant.automations.templates.title')"
              :options="[
                { value: 'all', label: t('tenant.automations.templates.all') },
                ...CATEGORIES.map((c) => ({
                  value: c,
                  label: t(`tenant.automations.templates.category.${c}`),
                })),
              ]"
            />
          </div>

          <IgAlert v-if="failed" tone="error" class="q-mb-md">
            {{ t('tenant.automations.templates.loadFailed') }}
            <template #action>
              <IgButton variant="ghost" size="sm" :label="t('common.retry')" @click="load" />
            </template>
          </IgAlert>
          <q-skeleton v-else-if="!loaded" height="140px" />
          <p v-else-if="!shown.length" class="ig-muted">
            {{ t('tenant.automations.templates.empty') }}
          </p>

          <div class="row q-col-gutter-md">
            <div v-for="tpl in shown" :key="tpl.id" class="col-12 col-md-6">
              <div class="ig-card q-pa-md column no-wrap full-height">
                <div class="text-subtitle1 text-weight-bold">{{ tpl.name }}</div>
                <div class="text-caption ig-muted q-mb-sm">
                  {{ t(`tenant.automations.templates.trigger.${tpl.trigger}`) }}
                </div>
                <p class="q-mt-none q-mb-sm col">{{ tpl.summary }}</p>
                <div class="row q-gutter-xs q-mb-md">
                  <span v-for="n in tpl.needs" :key="n" class="ig-pill ig-pill--warn">
                    {{ t(`tenant.automations.templates.needs.${n}`) }}
                  </span>
                  <span v-if="!tpl.needs.includes('ai')" class="ig-pill ig-pill--ok">
                    {{ t('tenant.automations.templates.noAi') }}
                  </span>
                </div>
                <div>
                  <IgButton
                    variant="secondary"
                    size="sm"
                    :label="t('tenant.automations.templates.use')"
                    @click="choose(tpl)"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- The questions of one template -->
        <form v-else class="column q-gutter-y-md" @submit.prevent="build">
          <p class="ig-muted q-mt-xs q-mb-none">{{ chosen.summary }}</p>
          <div class="row q-gutter-xs">
            <span v-for="n in chosen.needs" :key="n" class="ig-pill ig-pill--warn">
              {{ t(`tenant.automations.templates.needs.${n}`) }}
            </span>
          </div>
          <div>
            <div class="text-subtitle2 text-weight-bold">
              {{ t('tenant.automations.templates.questions') }}
            </div>
            <div class="text-caption ig-muted">
              {{ t('tenant.automations.templates.questionsIntro') }}
            </div>
          </div>
          <q-input
            v-for="p in chosen.params"
            :key="p.id"
            v-model="answers[p.id]"
            outlined
            :type="p.kind === 'longtext' ? 'textarea' : 'text'"
            :autogrow="p.kind === 'longtext'"
            :label="p.label"
            :error="touched && !!problems[p.id]"
            :error-message="problemText(p.id)"
            :hint="
              p.hint ??
              (p.kind === 'list'
                ? t('tenant.automations.templates.listHint')
                : p.kind === 'hour'
                  ? t('tenant.automations.templates.hourHint')
                  : '')
            "
          />
          <IgAlert v-if="refused" tone="error">{{
            t('tenant.automations.templates.refused')
          }}</IgAlert>
          <div class="row q-gutter-sm">
            <IgButton
              variant="ghost"
              :label="t('tenant.automations.templates.back')"
              :disable="building"
              @click="chosen = null"
            />
            <IgButton
              type="submit"
              variant="primary"
              :label="t('tenant.automations.templates.build')"
              :loading="building"
            />
          </div>
        </form>
      </div>
    </q-card>
  </q-dialog>
</template>
