import { defineBoot } from '#q-app';
import { createI18n } from 'vue-i18n';

import messages from '@/i18n';

export type MessageLanguages = keyof typeof messages;
// 'es-ES' is the master schema of the resource.
export type MessageSchema = (typeof messages)['es-ES'];

/* eslint-disable @typescript-eslint/no-empty-object-type */
declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
  export interface DefineDateTimeFormat {}
  export interface DefineNumberFormat {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export default defineBoot(({ app }) => {
  const i18n = createI18n<{ message: MessageSchema }, MessageLanguages>({
    locale: 'es-ES',
    fallbackLocale: 'es-ES',
    legacy: false,
    messages,
  });

  app.use(i18n);
});
