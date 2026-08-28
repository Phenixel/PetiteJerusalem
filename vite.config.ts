import { fileURLToPath, URL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

import { defineConfig, type Plugin } from 'vite'
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
 *  1. APP_VERSION, override explicite (build de test, CI maison)
 *  2. tag Git du build de release, deploy.yml et deploy-android.yml sont
 *     déclenchés par un push de tag vX.Y.Z, que GitHub expose dans
 *     GITHUB_REF_NAME (le checkout y est superficiel : `git describe` ne
 *     retrouverait rien)
 *  3. `git describe`, dev local et canaux de preview (dernier tag + nombre
 *     de commits depuis, ex. v3.3.4-7-gabc1234)
 *  4. version du package.json, dernier recours (clone sans historique Git)
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

/**
 * Publie la version de la release sur le site : `dist/app-version.json`.
 *
 * Ancienne source du bandeau de mise à jour Android : les apps y lisaient la
 * dernière version publiée pour se savoir périmées. Comme le fichier est en
 * ligne dès le déploiement du site, il annonçait la mise à jour pendant toute
 * la revue Google, alors que le Play Store ne la proposait pas encore ;
 * src/services/appUpdateService.ts interroge désormais l'API In-App Updates
 * du Play Store, qui répond pour l'appareil lui-même. Le fichier reste publié
 * pour les versions déjà installées qui le consultent encore ; à retirer
 * quand elles auront à peu près disparu (analytics `app_version`).
 */
function appVersionManifest(version: string): Plugin {
  return {
    name: 'pj-app-version-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'app-version.json',
        source: `${JSON.stringify({ version: version.replace(/^v/, '') }, null, 2)}\n`,
      })
    },
  }
}

const appVersion = resolveAppVersion()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  // Port dédié à ce projet pour pouvoir bosser sur plusieurs projets en
  // parallèle sans collision avec le 5173 par défaut de Vite.
  server: {
    port: 5473,
  },
  // Le badge flottant Vue DevTools polluerait les captures d'écran de la
  // fiche Play Store (scripts/store-screenshots.mjs).
  plugins: [
    vue(),
    ...(process.env.STORE_SCREENSHOTS ? [] : [vueDevTools()]),
    tailwindcss(),
    appVersionManifest(appVersion),
  ],
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
        // Firebase est volontairement scindé en deux : le cœur (app + auth,
        // requis dès le premier rendu) et Firestore, chargé à la demande via
        // src/firebase/firestore.ts, les regrouper ramènerait Firestore dans
        // le chargement initial. Storage et Functions, petits et cantonnés au
        // studio/admin, suivent le découpage naturel de Rollup.
        manualChunks: {
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          vue: ['vue', 'vue-router', 'vue-i18n'],
        },
      },
    },
  },
})
