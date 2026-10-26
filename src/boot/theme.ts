import '@fontsource-variable/inter';
import { defineBoot } from '#q-app';

import { initTheme } from '@/composables/useTheme';

export default defineBoot(() => {
  initTheme();
});
