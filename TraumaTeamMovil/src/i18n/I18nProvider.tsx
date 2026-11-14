import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { useSettings } from '@/settings/SettingsProvider';

import { SPEECH, translate, type Locale, type MessageKey, type TranslateParams } from './messages';

type I18nCtx = {
  locale: Locale;
  /** Cambia el idioma y lo persiste (vive en SettingsProvider). */
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
  /** Configuración de STT/TTS para el idioma activo. */
  speech: (typeof SPEECH)[Locale];
};

const I18nContext = createContext<I18nCtx | null>(null);

/** Expone el idioma activo (de `SettingsProvider`) y `t()`. Debe ir dentro de SettingsProvider. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale, setLocale } = useSettings();
  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(locale, key, params),
    [locale]
  );
  const value = useMemo(() => ({ locale, setLocale, t, speech: SPEECH[locale] }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n debe usarse dentro de <I18nProvider>');
  return ctx;
}
