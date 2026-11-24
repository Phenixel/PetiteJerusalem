import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [
        ...configDefaults.exclude,
        'e2e/**',
        // Projets natifs Capacitor (générés) et worktrees de session
        'android/**',
        'ios/**',
        '.claude/**',
        // The Cloud Functions' own suite (functions/test/) needs
        // their dependencies, installed apart: `npm test --prefix functions`.
        'functions/**',
      ],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
