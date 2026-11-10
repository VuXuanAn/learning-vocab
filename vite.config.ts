import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:4100' } },
  preview: { port: 4173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:4100' } },
  plugins: [react(), tailwindcss()],
})
