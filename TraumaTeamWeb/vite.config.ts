import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: ['VITE_', 'EXPO_PUBLIC_', 'DASHBOARD_'],
  server: {
    fs: {
      // Shared mission artwork and fonts also need to resolve during development.
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        fileURLToPath(new URL('../shared', import.meta.url)),
        fileURLToPath(new URL('../TraumaTeamMovil/assets', import.meta.url)),
      ],
    },
  },
})
