/**
 * Diccionarios de la app, divididos por área en `locales/<locale>/<area>.ts` y
 * mezclados aquí. Para agregar un idioma: añade el código a `LOCALES`, su
 * configuración de voz a `SPEECH` y una carpeta `locales/<locale>/` con las mismas
 * claves que `es` (TypeScript avisa si falta alguna). Ver README.md.
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
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import esBody from './locales/es/body.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import esCommon from './locales/es/common.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import esMissions from './locales/es/missions.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import esNav from './locales/es/nav.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import esSettings from './locales/es/settings.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import esVitals from './locales/es/vitals.ts';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import esVoice from './locales/es/voice.ts';

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Idioma del reconocedor (STT) y de la voz (TTS) por locale. */
export const SPEECH: Record<Locale, { lang: string; voicePrefix: string }> = {
  es: { lang: 'es-ES', voicePrefix: 'es' },
  en: { lang: 'en-US', voicePrefix: 'en' },
};

/** Cada área de `es` tiene que aportar claves únicas (lo verifica scripts/i18n.test.mjs). */
export const AREAS_ES = {
  common: esCommon,
  settings: esSettings,
  nav: esNav,
  voice: esVoice,
  vitals: esVitals,
  body: esBody,
  missions: esMissions,
};
export const AREAS_EN: Record<keyof typeof AREAS_ES, Record<string, string>> = {
  common: enCommon,
  settings: enSettings,
  nav: enNav,
  voice: enVoice,
  vitals: enVitals,
  body: enBody,
  missions: enMissions,
};

const es = {
  ...esCommon,
  ...esSettings,
  ...esNav,
  ...esVoice,
  ...esVitals,
  ...esBody,
  ...esMissions,
};

export type MessageKey = keyof typeof es;

const en: Record<MessageKey, string> = {
  ...enCommon,
  ...enSettings,
  ...enNav,
  ...enVoice,
  ...enVitals,
  ...enBody,
  ...enMissions,
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { es, en };

export type TranslateParams = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  const template = MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key];
  return params
    ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
    : template;
}
