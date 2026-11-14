import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_LOCALE, SPEECH, translate, type Locale, type MessageKey } from './messages';

type I18nCtx = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  /** Configuración de STT/TTS para el idioma activo. */
  speech: (typeof SPEECH)[Locale];
};

const I18nContext = createContext<I18nCtx | null>(null);

/** Idioma activo de la app. Hoy fijo en español; listo para un selector de idioma. */
export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );
  const value = useMemo(() => ({ locale, setLocale, t, speech: SPEECH[locale] }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n debe usarse dentro de <I18nProvider>');
  return ctx;
}
