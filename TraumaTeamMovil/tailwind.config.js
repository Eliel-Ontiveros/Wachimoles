const { platformSelect } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
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
          // Dark ("space night") palette for `dark:` variants, mirrors src/theme/palette.ts
          nightBg: '#05070f',
          nightAlt: '#111a2e',
          nightLine: '#1e293b',
          nightInk: '#f1f5f9',
          nightMuted: '#a3b1c6',
          nightSubtle: '#8391a7',
        },
      },
      fontFamily: {
        mono: platformSelect({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      },
    },
  },
  plugins: [],
};
