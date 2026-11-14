/**
 * Espejo en la app del catálogo de capacidades del backend (solo lo que se
 * dice en voz alta): por pantalla, qué muestra y 3 frases de ejemplo.
 * Los textos viven en i18n (`screen.<ruta>.summary` / `.ex1..3`).
 */
import type { MessageKey } from '../i18n/messages';
import type { Route } from './parser';

export const SCREENS: readonly Route[] = ['/', '/explore', '/missions'];

export function isScreen(value: unknown): value is Route {
  return typeof value === 'string' && (SCREENS as readonly string[]).includes(value);
}

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export function describeScreen(screen: Route, t: Translate): { title: string; summary: string; examples: string[] } {
  return {
    title: t(`route.${screen}` as MessageKey),
    summary: t(`screen.${screen}.summary` as MessageKey),
    examples: [1, 2, 3].map((n) => t(`screen.${screen}.ex${n}` as MessageKey)),
  };
}
