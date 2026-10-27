import { useI18n } from 'vue-i18n';

/** The name a person reads for a module or a limit; the id stays beside it for whoever needs it. */
export function useCatalogName() {
  const i18n = useI18n();
  return (kind: 'modules' | 'limits', id: string): string => {
    const key = `admin.catalog.${kind}.${id.replace(/\./g, '_')}`;
    return i18n.te(key) ? i18n.t(key) : id;
  };
}
