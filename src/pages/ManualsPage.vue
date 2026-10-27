<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import EmptyState from '@/components/EmptyState.vue';
import { findManual, manualsOf, renderMarkdown, type Series } from '@/utils/manuals';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const ops = computed(() => route.path.startsWith('/admin'));
const base = computed(() => (ops.value ? '/admin/help' : '/app/help'));
// The business owner reads their own series; the Ignis team reads both.
const allowed = computed<Series[]>(() => (ops.value ? ['equipo', 'cliente'] : ['cliente']));

const series = computed(() => String(route.params.series ?? ''));
const slug = computed(() => String(route.params.slug ?? ''));
const manual = computed(() =>
  allowed.value.includes(series.value as Series) ? findManual(series.value, slug.value) : undefined,
);
const list = computed(() =>
  allowed.value.includes(series.value as Series) ? manualsOf(series.value as Series) : [],
);

const html = computed(() =>
  manual.value
    ? renderMarkdown(manual.value.markdown, {
        series: manual.value.series,
        allowed: allowed.value,
        base: base.value,
      })
    : '',
);

const index = computed(() => list.value.findIndex((m) => m.slug === slug.value));
const prev = computed(() => (index.value > 0 ? list.value[index.value - 1] : undefined));
const next = computed(() => (index.value >= 0 ? list.value[index.value + 1] : undefined));

const go = (s: Series, sl: string) => router.push(`${base.value}/${s}/${sl}`);

function scrollToHash() {
  const id = decodeURIComponent(route.hash.slice(1));
  void nextTick(() => {
    const el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0 });
  });
}
watch(() => [route.fullPath, html.value], scrollToHash, { immediate: true });

function onClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest('a');
  if (!a) return;
  const to = a.getAttribute('data-route');
  const anchor = a.getAttribute('data-anchor');
  if (to) {
    e.preventDefault();
    void router.push(to);
  } else if (anchor) {
    e.preventDefault();
    document.getElementById(decodeURIComponent(anchor))?.scrollIntoView({ behavior: 'smooth' });
  }
}

const series_cards = computed(() => allowed.value.map((s) => ({ id: s, items: manualsOf(s) })));
</script>

<template>
  <q-page padding>
    <div class="q-mb-lg">
      <div class="ig-eyebrow q-mb-xs">{{ t('manuals.eyebrow') }}</div>
      <h1 class="text-h4 q-my-none">{{ t('manuals.title') }}</h1>
      <p class="ig-muted q-mt-sm q-mb-none">{{ t(ops ? 'manuals.introOps' : 'manuals.intro') }}</p>
    </div>

    <template v-if="!series">
      <div v-for="s in series_cards" :key="s.id" class="q-mb-xl">
        <h2 class="text-h6 q-mt-none q-mb-xs">{{ t(`manuals.series.${s.id}.title`) }}</h2>
        <p class="ig-muted q-mb-md">{{ t(`manuals.series.${s.id}.hint`) }}</p>
        <div class="ig-manuals__grid">
          <button
            v-for="m in s.items"
            :key="m.slug"
            type="button"
            class="ig-card ig-manuals__card"
            @click="go(s.id, m.slug)"
          >
            <span class="ig-eyebrow">{{ m.slug.slice(0, 2) }}</span>
            <span class="text-subtitle1 text-weight-bold">{{ m.title }}</span>
          </button>
        </div>
      </div>
    </template>

    <EmptyState
      v-else-if="!manual"
      icon="menu_book"
      :title="t('manuals.notFound')"
      :hint="t('manuals.notFoundHint')"
    >
      <q-btn flat no-caps color="primary" :label="t('manuals.all')" :to="base" />
    </EmptyState>

    <div v-else class="row q-col-gutter-lg">
      <div class="col-12 col-md-3">
        <q-btn
          flat
          no-caps
          dense
          icon="arrow_back"
          :label="t('manuals.all')"
          :to="base"
          class="q-mb-sm"
        />
        <div class="ig-eyebrow q-mb-xs">{{ t(`manuals.series.${manual.series}.title`) }}</div>
        <nav class="ig-manuals__toc gt-sm" :aria-label="t('manuals.title')">
          <router-link
            v-for="m in list"
            :key="m.slug"
            :to="`${base}/${m.series}/${m.slug}`"
            :class="{ 'is-active': m.slug === slug }"
          >
            {{ m.title }}
          </router-link>
        </nav>
        <q-select
          behavior="menu"
          popup-content-class="ig-menu"
          class="lt-md"
          dense
          outlined
          emit-value
          map-options
          :model-value="slug"
          :options="list.map((m) => ({ label: m.title, value: m.slug }))"
          @update:model-value="(v: string) => go(manual!.series, v)"
        />
      </div>

      <div class="col-12 col-md-9">
        <article class="ig-card q-pa-lg ig-manuals__doc">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="ig-doc" @click="onClick" v-html="html" />
        </article>
        <div class="row justify-between q-mt-md">
          <q-btn
            v-if="prev"
            flat
            no-caps
            icon="chevron_left"
            :label="prev.title"
            @click="go(prev.series, prev.slug)"
          />
          <span v-else />
          <q-btn
            v-if="next"
            flat
            no-caps
            icon-right="chevron_right"
            :label="next.title"
            @click="go(next.series, next.slug)"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<style scoped lang="scss">
.ig-manuals__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.ig-manuals__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  color: var(--ig-text);
  transition: border-color 0.15s var(--ig-ease);
  &:hover {
    border-color: var(--ig-brand-500);
  }
}
.ig-manuals__toc {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 16px;
  a {
    padding: 6px 10px;
    border-radius: var(--ig-r-sm);
    color: var(--ig-muted);
    text-decoration: none;
    font-size: 14px;
    &:hover {
      background: var(--ig-surface-2);
      color: var(--ig-text);
    }
    &.is-active {
      background: var(--ig-surface-3);
      color: var(--ig-text);
      font-weight: 600;
    }
  }
}
.ig-manuals__doc {
  min-width: 0;
}
.ig-doc {
  line-height: 1.65;
  overflow-wrap: anywhere;
  :deep(h1) {
    font-size: 1.7rem;
    margin: 0 0 16px;
  }
  :deep(h2) {
    font-size: 1.3rem;
    margin: 32px 0 12px;
    scroll-margin-top: 16px;
  }
  :deep(h3) {
    font-size: 1.08rem;
    margin: 24px 0 8px;
    scroll-margin-top: 16px;
  }
  :deep(h4) {
    scroll-margin-top: 16px;
  }
  :deep(img) {
    max-width: 100%;
    height: auto;
    border: 1px solid var(--ig-line);
    border-radius: var(--ig-r-md);
    margin: 8px 0;
  }
  :deep(a) {
    color: var(--ig-link);
  }
  :deep(code) {
    font-family: var(--ig-font-mono);
    font-size: 0.88em;
    background: var(--ig-surface-3);
    padding: 1px 5px;
    border-radius: 4px;
  }
  :deep(pre) {
    background: var(--ig-surface-2);
    border: 1px solid var(--ig-line);
    border-radius: var(--ig-r-md);
    padding: 12px;
    overflow-x: auto;
    code {
      background: none;
      padding: 0;
    }
  }
  :deep(blockquote) {
    margin: 12px 0;
    padding: 4px 14px;
    border-left: 3px solid var(--ig-brand-500);
    background: var(--ig-surface-2);
    color: var(--ig-muted);
  }
  :deep(table) {
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
    margin: 12px 0;
    th,
    td {
      border: 1px solid var(--ig-line);
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: var(--ig-surface-2);
    }
  }
  :deep(hr) {
    border: 0;
    border-top: 1px solid var(--ig-line);
    margin: 28px 0;
  }
}
</style>
