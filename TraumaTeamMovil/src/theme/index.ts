import { useMemo } from 'react';

import { useSettings, type ThemePreference } from '@/settings/SettingsProvider';

import { PALETTES, type Palette, type Scheme } from './palette';

export { darkPalette, lightPalette, PALETTES } from './palette';
export type { Palette, Scheme } from './palette';
export type { ThemePreference };

/** Tema efectivo: `scheme` ya resuelto (sistema → claro/oscuro) y su paleta. */
export function useAppTheme(): {
  scheme: Scheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
} {
  const { scheme, themePreference, setThemePreference } = useSettings();
  return useMemo(
    () => ({ scheme, colors: PALETTES[scheme], preference: themePreference, setPreference: setThemePreference }),
    [scheme, themePreference, setThemePreference]
  );
}
