import { defineConfig, devices } from "playwright/test";

/**
 * Tests de bout en bout (Playwright), lancés par `npm run test:e2e`.
 *
 * L'app tourne sur le serveur de dev Vite (mode DEV, donc branchée sur les
 * émulateurs Firebase, comme `npm run dev`). Deux projets :
 *
 *  - `public` : les pages qui ne parlent pas à Firebase (accueil visiteur,
 *    bibliothèque, lecteur, horaires, calendrier, contenus, langues). Aucun
 *    prérequis au-delà de Node et de Chromium.
 *  - `firebase` : comptes, chaînes de lecture, réservations, chiourim. Ces
 *    tests ont besoin des émulateurs Auth et Firestore ; `scripts/e2e.mjs` les
 *    démarre (CLI firebase) ou se rabat sur des émulateurs déjà lancés
 *    (`npm run dev:local`). Sans émulateur, ils se déclarent ignorés au lieu
 *    d'échouer.
 *
 * Le port 5474 est voisin du 5473 du dev, pour que la suite tourne à côté
 * d'une session de dev sans lui prendre son serveur.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 5474);
const baseURL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: "./test-results",
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    // Un Chromium déjà présent sur la machine (image de CI, bac à sable) à la
    // place de celui que `npx playwright install` téléchargerait.
    ...(process.env.E2E_CHROMIUM
      ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM } }
      : {}),
  },
  projects: [
    { name: "public", testDir: "./e2e/public" },
    { name: "firebase", testDir: "./e2e/firebase" },
  ],
  webServer: {
    command: `npx vite --port ${E2E_PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Sans le badge flottant Vue DevTools, qui recouvrirait des boutons en
    // bas d'écran (même garde que les captures des fiches, cf. vite.config.ts).
    env: { STORE_SCREENSHOTS: "1" },
  },
});
