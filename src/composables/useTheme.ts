import { Dark } from 'quasar';

const KEY = 'ignis-theme';

/** Light, dark or the system's choice; remembered on this device only. */
export function initTheme() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // storage blocked: follow the system.
  }
  Dark.set(saved === 'dark' ? true : saved === 'light' ? false : 'auto');
}

export function toggleTheme() {
  const next = Dark.isActive ? 'light' : 'dark';
  Dark.set(next === 'dark');
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore.
  }
}
