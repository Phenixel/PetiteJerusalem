import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    'functions/**',
    // Librairies tierces vendorisées (servies telles quelles, non éditées)
    'public/vendor/**',
    // Projets natifs Capacitor (générés par `npx cap add`) et worktrees de session
    'android/**',
    'ios/**',
    '.claude/**',
  ]),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
    rules: {
      ...pluginVitest.configs.recommended.rules,
      // Un test peut confier ses assertions à un helper du fichier (la
      // cohérence d'un pbxproj se vérifie de la même façon trois fois de
      // suite) : la règle ne les voit pas, il faut les lui nommer.
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*'] }],
    },
  },
  skipFormatting,
)
