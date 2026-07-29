import { fileURLToPath, URL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

/**
 * Version applicative figée dans le bundle (super propriété PostHog
 * `app_version`, et rien d'autre pour l'instant). Sans elle, impossible de
 * rattacher une erreur ou une régression à une release précise : c'est le
 * breakdown des tuiles d'erreurs du dashboard produit.
 *
 * Repli, du plus fiable au plus dégradé :
 *  1. APP_VERSION — override explicite (build de test, CI maison)
 *  2. tag Git du build de release — deploy.yml et deploy-android.yml sont
 *     déclenchés par un push de tag vX.Y.Z, que GitHub expose dans
 *     GITHUB_REF_NAME (le checkout y est superficiel : `git describe` ne
 *     retrouverait rien)
 *  3. `git describe` — dev local et canaux de preview (dernier tag + nombre
 *     de commits depuis, ex. v3.3.4-7-gabc1234)
 *  4. version du package.json — dernier recours (clone sans historique Git)
 */
function resolveAppVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME
  }
  try {
    return execFileSync('git', ['describe', '--tags', '--always'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim()
  } catch {
    return createRequire(import.meta.url)('./package.json').version
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
  // Port dédié à ce projet pour pouvoir bosser sur plusieurs projets en
  // parallèle sans collision avec le 5173 par défaut de Vite.
  server: {
    port: 5473,
  },
  // Le badge flottant Vue DevTools polluerait les captures d'écran de la
  // fiche Play Store (scripts/store-screenshots.mjs).
  plugins: [vue(), ...(process.env.STORE_SCREENSHOTS ? [] : [vueDevTools()]), tailwindcss()],
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
