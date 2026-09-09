#!/usr/bin/env node
/**
 * Lance la suite de bout en bout (Playwright) avec ce qu'il faut autour.
 *
 *   npm run test:e2e                      toute la suite
 *   npm run test:e2e -- --project public  sans Firebase
 *   npm run test:e2e -- e2e/firebase/auth.spec.ts --headed
 *
 * Les tests du projet `firebase` veulent les émulateurs Auth et Firestore :
 *
 *  1. s'ils répondent déjà (`npm run dev:local` ou `npm run emulators` à
 *     côté), la suite s'y branche telle quelle ;
 *  2. sinon, si le CLI firebase est installé (`npm i -g firebase-tools`,
 *     comme pour le dev), il en démarre des vides le temps de la suite
 *     (`emulators:exec`) et les arrête en sortant ;
 *  3. sinon, la suite tourne quand même et les tests Firebase se déclarent
 *     ignorés, avec la marche à suivre.
 *
 * Le serveur Vite est lancé par Playwright lui-même (playwright.config.ts).
 */
import { spawnSync } from "node:child_process";
import { emulatorsReachable } from "./lib/firebase-emulator.mjs";

const args = process.argv.slice(2);
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, commandArgs) {
  const res = spawnSync(command, commandArgs, { stdio: "inherit" });
  process.exit(res.status ?? 1);
}

/** Vrai si un `firebase` répond sur le PATH. */
function firebaseCliAvailable() {
  const res = spawnSync("firebase", ["--version"], { encoding: "utf8" });
  return !res.error && res.status === 0;
}

/** Cite un argument pour le shell qu'utilisera `emulators:exec`. */
const quote = (arg) => `'${String(arg).replace(/'/g, `'\\''`)}'`;

if (await emulatorsReachable()) {
  console.log("e2e : émulateurs Firebase déjà lancés, la suite s'y branche.");
  run(npx, ["playwright", "test", ...args]);
} else if (firebaseCliAvailable()) {
  console.log("e2e : démarrage d'émulateurs Firebase vides le temps de la suite.");
  const script = [npx, "playwright", "test", ...args].map(quote).join(" ");
  run("firebase", ["emulators:exec", "--only", "auth,firestore", script]);
} else if (process.env.CI) {
  // En local, sauter les tests Firebase est un service rendu. En CI, ce serait
  // un job vert qui n'a pas joué un tiers de la suite, sans que personne le
  // voie : mieux vaut échouer sur l'installation manquante.
  console.error(
    "e2e : ni émulateur en cours ni CLI firebase, et la CI ne doit pas passer sans les tests Firebase (voir l'étape « Install Firebase CLI » de ci.yml).",
  );
  process.exit(1);
} else {
  console.warn(
    "e2e : ni émulateur en cours ni CLI firebase (npm i -g firebase-tools) : les tests Firebase seront ignorés.",
  );
  run(npx, ["playwright", "test", ...args]);
}
