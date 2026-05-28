import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  base: "/TER_CAILLET_ILLOUZ/",
  test: {
    // Permet d'utiliser 'describe', 'it', 'expect' sans les importer
    globals: true,
    // Simule l'environnement du navigateur
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
