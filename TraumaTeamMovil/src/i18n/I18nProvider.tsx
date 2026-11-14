import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_LOCALE, SPEECH, translate, type Locale, type MessageKey, type TranslateParams } from './messages';

type I18nCtx = {
  /** Idioma de la interfaz: siempre inglés. */
  locale: Locale;
  t: (key: MessageKey, params?: TranslateParams) => string;
  /** Configuración de TTS (la app siempre habla en inglés). */
  speech: (typeof SPEECH)[Locale];
};

const I18nContext = createContext<I18nCtx | null>(null);

/** Expone `t()` (solo inglés) y la configuración de voz de salida. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const t = useCallback((key: MessageKey, params?: TranslateParams) => translate(DEFAULT_LOCALE, key, params), []);
  const value = useMemo(() => ({ locale: DEFAULT_LOCALE, t, speech: SPEECH[DEFAULT_LOCALE] }), [t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
