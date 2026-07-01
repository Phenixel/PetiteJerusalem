import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Port dédié à ce projet pour pouvoir bosser sur plusieurs projets en
  // parallèle sans collision avec le 5173 par défaut de Vite.
  server: {
    port: 5473,
  },
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Sépare les vendors du code applicatif : une modif applicative
        // n'invalide pas le cache navigateur des gros chunks stables.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          vue: ['vue', 'vue-router', 'vue-i18n'],
        },
      },
    },
  },
})
