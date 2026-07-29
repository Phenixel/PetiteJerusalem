/// <reference types="vite/client" />

/**
 * Version applicative injectée au build par `define` (voir vite.config.ts).
 * Toujours définie : Vite la remplace littéralement à la compilation, y
 * compris pendant les tests (vitest.config.ts fusionne la config Vite).
 */
declare const __APP_VERSION__: string;
