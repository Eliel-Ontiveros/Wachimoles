/**
 * Diccionario de la app (solo inglés), dividido por área en `locales/en/<area>.ts` y
 * mezclado aquí. `MessageKey` se deriva de él. Ver README.md.
 */
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import enBody from './locales/en/body.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import enCommon from './locales/en/common.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import enMissions from './locales/en/missions.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import enNav from './locales/en/nav.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import enSettings from './locales/en/settings.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import enVitals from './locales/en/vitals.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import enVoice from './locales/en/voice.ts';

export const LOCALES = ['en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Idioma de la voz (TTS) de la app: siempre inglés. */
export const SPEECH: Record<Locale, { lang: string; voicePrefix: string }> = {
  en: { lang: 'en-US', voicePrefix: 'en' },
};

/** Idioma de entrada del reconocedor de voz (STT); el usuario elige en Ajustes. */
export const VOICE_LANGUAGES = ['en', 'es'] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number];
export const DEFAULT_VOICE_LANGUAGE: VoiceLanguage = 'en';
export const STT_LANG: Record<VoiceLanguage, string> = { en: 'en-US', es: 'es-ES' };

export function isVoiceLanguage(value: unknown): value is VoiceLanguage {
  return typeof value === 'string' && (VOICE_LANGUAGES as readonly string[]).includes(value);
}

/** Cada área tiene que aportar claves únicas (lo verifica scripts/i18n.test.mjs). */
export const AREAS = {
  common: enCommon,
  settings: enSettings,
  nav: enNav,
  voice: enVoice,
  vitals: enVitals,
  body: enBody,
  missions: enMissions,
};

const en = {
  ...enCommon,
  ...enSettings,
  ...enNav,
  ...enVoice,
  ...enVitals,
  ...enBody,
  ...enMissions,
};

export type MessageKey = keyof typeof en;

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en };

export type TranslateParams = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  const template = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key];
  return params
    ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
    : template;
}
