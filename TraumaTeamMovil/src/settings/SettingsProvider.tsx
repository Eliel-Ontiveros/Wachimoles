import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme as nativewindColorScheme } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { DEFAULT_VOICE_LANGUAGE, isVoiceLanguage, type VoiceLanguage } from '@/i18n/messages';

export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

const STORAGE_KEY = 'traumateam.settings.v1';

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

type SettingsCtx = {
  /** Idioma de entrada del reconocedor de voz (la interfaz es solo en inglés). */
  voiceLanguage: VoiceLanguage;
  setVoiceLanguage: (language: VoiceLanguage) => void;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  /** Tema efectivo (la preferencia 'system' ya resuelta con el del dispositivo). */
  scheme: 'light' | 'dark';
};

const SettingsContext = createContext<SettingsCtx | null>(null);

/**
 * Preferencias de la app (idioma de voz y tema), persistidas en AsyncStorage.
 * Renderiza de inmediato con los valores por defecto y aplica los guardados al cargar.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [voiceLanguage, setVoiceLanguageState] = useState<VoiceLanguage>(DEFAULT_VOICE_LANGUAGE);
  const [themePreference, setThemeState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const systemScheme = useColorScheme();
  /** Si el usuario cambia algo antes de que termine la carga, no lo pisamos. */
  const touched = useRef({ voiceLanguage: false, theme: false });
  const current = useRef({ voiceLanguage: DEFAULT_VOICE_LANGUAGE as VoiceLanguage, theme: DEFAULT_THEME_PREFERENCE });

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const stored = JSON.parse(raw) as { voiceLanguage?: unknown; theme?: unknown };
        if (!touched.current.voiceLanguage && isVoiceLanguage(stored.voiceLanguage)) setVoiceLanguageState(stored.voiceLanguage);
        if (!touched.current.theme && isThemePreference(stored.theme)) setThemeState(stored.theme);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(() => {
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voiceLanguage: current.current.voiceLanguage, theme: current.current.theme })
    ).catch(() => {});
  }, []);

  const setVoiceLanguage = useCallback(
    (next: VoiceLanguage) => {
      if (!isVoiceLanguage(next)) return;
      touched.current.voiceLanguage = true;
      current.current.voiceLanguage = next;
      setVoiceLanguageState(next);
      persist();
    },
    [persist]
  );
  const setThemePreference = useCallback(
    (next: ThemePreference) => {
      if (!isThemePreference(next)) return;
      touched.current.theme = true;
      current.current.theme = next;
      setThemeState(next);
      persist();
    },
    [persist]
  );
  useEffect(() => {
    current.current = { voiceLanguage, theme: themePreference };
  }, [voiceLanguage, themePreference]);

  const scheme: 'light' | 'dark' =
    themePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePreference;

  // NativeWind: activa las variantes `dark:` (clase `dark` en <html> en web).
  useEffect(() => {
    nativewindColorScheme.set(scheme);
  }, [scheme]);

  const value = useMemo(
    () => ({ voiceLanguage, setVoiceLanguage, themePreference, setThemePreference, scheme }),
    [voiceLanguage, setVoiceLanguage, themePreference, setThemePreference, scheme]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
