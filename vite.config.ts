import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:4100' } },
  preview: { port: 4173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:4100' } },
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
    manifest: {
      id: '/',
      name: 'Vocab Library',
      short_name: 'Vocab Library',
      description: 'Học từ vựng, ôn tập thẻ, luyện đọc và luyện nói tiếng Anh.',
      lang: 'vi',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#047857',
      background_color: '#ffffff',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Cache only the app shell; API, account data and audio remain network-only.
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/auth(?:\/|$)/],
      cleanupOutdatedCaches: true,
    },
    devOptions: { enabled: false },
  })],
})
