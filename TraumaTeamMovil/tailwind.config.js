const { platformSelect } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app has a single light theme (no `dark:` classes). 'class' stops NativeWind on web from
  // throwing when something (OS theme, extensions) toggles a class on <html>.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        trauma: {
          bg: '#f7f7f7',
          ink: '#111827',
          muted: '#64748b',
          line: '#e2e8f0',
          cyan: '#58d5f7',
          cyanSoft: '#bbf2fd',
          cyanEdge: '#7dd3fc',
          cyanDeep: '#0284c7',
          night: '#0a0f1d',
        },
      },
      fontFamily: {
        mono: platformSelect({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      },
    },
  },
  plugins: [],
};
