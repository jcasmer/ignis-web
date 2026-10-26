import { onBeforeUnmount, onMounted } from 'vue';

/**
 * Reads a screen again when the person comes back to the tab after a while, so what Ignis or
 * a teammate changed meanwhile (a module enabled, credit granted) shows without a manual refresh.
 * Only for screens that list data: a form being edited must not be overwritten.
 */
export function refreshOnFocus(load: () => unknown, minGapMs = 20_000) {
  let last = Date.now();
  const onVisible = () => {
    if (document.hidden || Date.now() - last < minGapMs) return;
    last = Date.now();
    void load();
  };
  onMounted(() => document.addEventListener('visibilitychange', onVisible));
  onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible));
}
