/// <reference types="vite/client" />

/**
 * Version applicative injectée au build par `define` (voir vite.config.ts).
 * Toujours définie : Vite la remplace littéralement à la compilation, y
 * compris pendant les tests (vitest.config.ts fusionne la config Vite).
 */
declare const __APP_VERSION__: string;

/**
 * Environnement visé par ce build (PJ_ENV, voir scripts/lib/environments.mjs),
 * injecté par `define` comme __APP_VERSION__.
 */
declare const __PJ_ENV__: {
  name: "production" | "staging";
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  siteUrl: string;
};
