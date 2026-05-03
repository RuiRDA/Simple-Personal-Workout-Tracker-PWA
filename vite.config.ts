import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pagesBase = process.env.GITHUB_ACTIONS
  ? '/Simple-Personal-Workout-Tracker-PWA/'
  : './'

// https://vite.dev/config/
export default defineConfig({
  base: pagesBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg'],
      manifest: {
        name: 'Workout Tracker',
        short_name: 'Workout',
        description: 'A local-first quick workout log for small sets.',
        theme_color: '#2563eb',
        background_color: '#f6f7f3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: pagesBase,
        scope: pagesBase,
        icons: [
          {
            src: `${pagesBase}app-icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    }),
  ],
})
