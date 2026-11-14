import type es from '../es/settings';

/** Ajustes de idioma y tema (en). */
const settings: Record<keyof typeof es, string> = {
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.lang.es': 'Español',
  'settings.lang.en': 'English',
  'settings.theme.system': 'System',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.themeChanged.system': 'System theme enabled',
  'settings.themeChanged.light': 'Light mode enabled',
  'settings.themeChanged.dark': 'Dark mode enabled',
  'settings.localeChanged': 'Language changed to English',
  'settings.switchToDark': 'Switch to dark mode',
  'settings.switchToLight': 'Switch to light mode',
};

export default settings;
