/** Paleta semántica para props de estilo (`style`, `color` de iconos, SVG). Ver README.md. */
export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  /** Color de texto/icono sobre `accent` rellenos. */
  onAccent: string;
  accent: string;
  accentSoft: string;
  accentEdge: string;
  accentDeep: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  /** Fondo semitransparente tras modales/drawer. */
  overlay: string;
  /** Color de sombra de tarjetas (`shadowColor`). */
  shadow: string;
  /** Opacidad de sombra recomendada para tarjetas. */
  shadowOpacity: number;
};

export const lightPalette: Palette = {
  bg: '#f7f7f7',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  border: '#e2e8f0',
  text: '#111827',
  textMuted: '#64748b',
  textSubtle: '#94a3b8',
  onAccent: '#ffffff',
  accent: '#58d5f7',
  accentSoft: '#bbf2fd',
  accentEdge: '#7dd3fc',
  accentDeep: '#0284c7',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  success: '#059669',
  successSoft: '#ecfdf5',
  overlay: 'rgba(15,23,42,0.4)',
  shadow: '#0f172a',
  shadowOpacity: 0.08,
};

/** "Space night": superficies #05070f / #0a0f1d, acentos cian de la marca. */
export const darkPalette: Palette = {
  bg: '#05070f',
  surface: '#0a0f1d',
  surfaceAlt: '#111a2e',
  border: '#1e293b',
  text: '#f1f5f9',
  textMuted: '#a3b1c6',
  textSubtle: '#8391a7',
  onAccent: '#05070f',
  accent: '#58d5f7',
  accentSoft: '#0e3a4d',
  accentEdge: '#7dd3fc',
  accentDeep: '#7dd3fc',
  danger: '#f87171',
  dangerSoft: '#3a1216',
  warning: '#fbbf24',
  warningSoft: '#3a2a0a',
  success: '#34d399',
  successSoft: '#0a2e22',
  overlay: 'rgba(0,0,0,0.65)',
  shadow: '#000000',
  shadowOpacity: 0.5,
};

export type Scheme = 'light' | 'dark';
export const PALETTES: Record<Scheme, Palette> = { light: lightPalette, dark: darkPalette };
