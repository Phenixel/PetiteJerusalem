import { globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import pluginVitest from "@vitest/eslint-plugin";
import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";

export default defineConfigWithVueTs(
  {
    name: "app/files-to-lint",
    files: ["**/*.{ts,mts,tsx,vue}"],
  },

  globalIgnores([
    "**/dist/**",
    "**/dist-ssr/**",
    "**/coverage/**",
    // Cloud Functions: the sources are linted, the compiled output is not.
    "functions/lib/**",
    // The promotional videos: a separate Remotion project (promo/README.md),
    // checked by its own type-check.
    "promo/**",
    // Projets natifs Capacitor (générés par `npx cap add`) et worktrees de session
    "android/**",
    "ios/**",
    ".claude/**",
  ]),

  pluginVue.configs["flat/essential"],
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ["src/**/__tests__/*"],
    rules: {
      ...pluginVitest.configs.recommended.rules,
      // Un test peut confier ses assertions à un helper du fichier (la
      // cohérence d'un pbxproj se vérifie de la même façon trois fois de
      // suite) : la règle ne les voit pas, il faut les lui nommer.
      "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "expect*"] }],
    },
  },

  // A promise nobody awaits loses its rejection: the application code says
  // `await`, or `void` when the call is fire-and-forget on purpose. These two
  // rules need type information, hence the cost of a typed lint pass.
  {
    name: "app/promises",
    files: ["src/**/*.{ts,tsx,vue}"],
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },

  // Node scripts (build, release, back office): plain ES modules, outside
  // the TypeScript projects, so they get the core recommended rules only.
  {
    name: "app/node-scripts",
    files: ["*.mjs", "scripts/**/*.mjs", "functions/scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      // The core rule above already reports it: no double report.
      "@typescript-eslint/no-unused-vars": "off",
      // French comments and generated texts carry the non-breaking spaces
      // CLAUDE.md asks for.
      "no-irregular-whitespace": ["error", { skipComments: true, skipTemplates: true }],
      // Classes of nikud or emoji selectors list combining marks on purpose,
      // always as escapes.
      "no-misleading-character-class": ["error", { allowEscape: true }],
    },
  },
  // The scripts that drive a browser pass callbacks that run in the page.
  {
    name: "app/node-scripts-in-page",
    files: ["scripts/layout/capture.mjs", "scripts/store-screenshots.mjs"],
    languageOptions: {
      globals: { window: "readonly", document: "readonly", localStorage: "readonly" },
    },
  },
  skipFormatting,
);
