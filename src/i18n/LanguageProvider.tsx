import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LOCALES, SUPPORTED_LOCALES, isLocale, localeOrDefault, type Locale } from './locale';
import { formatMessage, translate } from './translate';
import type { MessageKey } from './catalogs';
import { loadStudentSession, saveStudentSession, STUDENT_SESSION_CHANGED_EVENT } from '../utils/student-session';
import { toTournamentHttpBaseUrl } from '../tournament/server-config';

export const LANGUAGE_STORAGE_KEY = 'crjm-language';
function readBrowserLocale(): Locale {
  try { return localeOrDefault(localStorage.getItem(LANGUAGE_STORAGE_KEY)); }
  catch { return DEFAULT_LOCALE; }
}
function initialLocale(): Locale {
  return loadStudentSession()?.locale ?? readBrowserLocale();
}
function saveBrowserLocale(locale: Locale): void {
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, locale); } catch { /* Storage can be disabled. */ }
}

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  saveError: boolean;
}
const LanguageContext = createContext<LanguageContextValue>({ locale: DEFAULT_LOCALE, setLocale: () => {}, saveError: false });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  const [saveError, setSaveError] = useState(false);
  const writes = useRef(Promise.resolve());
  const generation = useRef(0);

  useEffect(() => {
    const sync = () => { generation.current += 1; updateLocale(initialLocale()); setSaveError(false); };
    const storage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === 'crjm-student-session' || event.key === null) sync();
    };
    window.addEventListener(STUDENT_SESSION_CHANGED_EVENT, sync);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(STUDENT_SESSION_CHANGED_EVENT, sync);
      window.removeEventListener('storage', storage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALES[locale].direction;
    document.title = translate('Jogos Matemáticos — Treino para o CRJM', locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    setSaveError(false);
    const session = loadStudentSession();
    if (!session) { saveBrowserLocale(next); return; }
    saveStudentSession({ ...session, locale: next });
    const currentGeneration = generation.current;
    // Serialize choices so a slow earlier request cannot overwrite the latest one.
    writes.current = writes.current.then(async () => {
      try {
        const response = await fetch(`${toTournamentHttpBaseUrl(session.serverUrl)}/api/student/locale`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: session.code, locale: next }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error('locale save failed');
      } catch {
        if (generation.current === currentGeneration) setSaveError(true);
      }
    });
  }, []);

  const value = useMemo(() => ({ locale, setLocale, saveError }), [locale, setLocale, saveError]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function localizeNode(value: ReactNode, locale: Locale): ReactNode {
  if (typeof value === 'string') return translate(value, locale);
  if (Array.isArray(value)) return value.map(item => localizeNode(item, locale));
  return value;
}
export function useTranslation() {
  const context = useContext(LanguageContext);
  const t = useMemo(() => {
    function localized(value: string): string;
    function localized(value: string | undefined): string | undefined;
    function localized(value: ReactNode): ReactNode;
    function localized(value: ReactNode): ReactNode { return localizeNode(value, context.locale); }
    return localized;
  }, [context.locale]);
  const msg = useCallback((key: MessageKey, values?: readonly (string | number)[]) => formatMessage(key, context.locale, values), [context.locale]);
  return { ...context, t, msg };
}

export function LanguageSelector() {
  const { locale, setLocale, saveError, t } = useTranslation();
  return <div className="flex shrink-0 flex-col items-end">
    <select aria-label={t('Idioma')} data-language-selector value={locale}
      onChange={event => { if (isLocale(event.target.value)) setLocale(event.target.value); }}
      className="max-w-28 rounded-lg border px-1 py-1.5 text-xs [background:var(--painel)] [color:var(--tinta)] [border-color:var(--linha)]">
      <option hidden disabled value="">{t('Idioma')}</option>
      {SUPPORTED_LOCALES.map(code => <option key={code} value={code} lang={code}>{LOCALES[code].name}</option>)}
    </select>
    {saveError && <span role="status" className="max-w-40 text-xs [color:var(--perigo)]">
      {t('Língua guardada neste dispositivo. Não foi possível atualizar o perfil.')}
      <button type="button" className="ml-1 underline" onClick={() => setLocale(locale)}>{t('Tentar novamente')}</button>
    </span>}
  </div>;
}
