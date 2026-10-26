import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

/**
 * The value of `source`, reached by counting from the previous one. It jumps at
 * once for people who asked for reduced motion.
 */
export function useCountUp(source: Ref<number>, ms = 700): Ref<number> {
  const shown = ref(source.value);
  let frame = 0;

  const reduced = () =>
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  watch(source, (to, from) => {
    cancelAnimationFrame(frame);
    if (reduced() || from === to) {
      shown.value = to;
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      shown.value = from + (to - from) * eased;
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  });

  onBeforeUnmount(() => cancelAnimationFrame(frame));
  return shown;
}
