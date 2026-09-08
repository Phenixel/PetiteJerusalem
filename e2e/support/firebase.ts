import type { Page } from "playwright/test";
import { test as base, expect } from "./fixtures";
import {
  createEmulatorUser,
  emulatorsReachable,
  readDoc,
  seedDoc,
} from "../../scripts/lib/firebase-emulator.mjs";

/**
 * Tests qui parlent à Firebase : comptes, chaînes de lecture, chiourim.
 *
 * Ils tournent contre les émulateurs Auth et Firestore, et s'ignorent d'eux-
 * mêmes s'ils ne répondent pas (`scripts/e2e.mjs` les lance avec le CLI
 * firebase, ou réutilise ceux de `npm run dev:local`). Chaque test crée ses
 * propres données, avec un suffixe unique : la suite tolère un émulateur qui
 * a déjà servi, et les tests peuvent tourner en parallèle.
 */

type FirebaseFixtures = {
  /** Vrai si les émulateurs répondent ; sinon le test est ignoré. */
  emulators: boolean;
};

export const test = base.extend<object, FirebaseFixtures>({
  emulators: [
    async ({}, use) => {
      await use(await emulatorsReachable());
    },
    { scope: "worker" },
  ],
});

test.beforeEach(({ emulators }) => {
  test.skip(
    !emulators,
    "Émulateurs Firebase absents : `npm run test:e2e` les démarre avec le CLI firebase (npm i -g firebase-tools), ou lancez `npm run emulators` à côté.",
  );
});

export { expect, readDoc, seedDoc };

let counter = 0;
/** Un suffixe unique par test et par processus, pour ne rien partager. */
export function uniqueId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${process.pid.toString(36)}-${counter}`;
}

export type TestAccount = { uid: string; email: string; password: string; name: string };

/** Crée un compte dans l'émulateur Auth, sans passer par l'interface. */
export async function createAccount(label = "test"): Promise<TestAccount> {
  const id = uniqueId();
  const account = {
    email: `${label}-${id}@example.com`,
    password: `Mdp-${id}`,
    name: `Testeur ${id.slice(-4)}`,
  };
  const uid = await createEmulatorUser({
    email: account.email,
    password: account.password,
    displayName: account.name,
  });
  return { uid, ...account };
}

/** Se connecte par le formulaire email de /login, et attend d'en sortir. */
export async function signIn(page: Page, account: TestAccount, redirect?: string): Promise<void> {
  const target = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login";
  await page.goto(target);
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Tehilim 1 à 150 : identifiants 103 à 252 dans src/datas/textStudies.json. */
export const tehilimId = (n: number): string => String(102 + n);

const DAY = 24 * 3600 * 1000;

export type SeededSession = { id: string; slug: string; name: string };

/** Le premier sefer des Tehilim (psaumes 1 à 41), tel que nommé dans le catalogue. */
export const TEHILIM_SEFER_1 = "ספר 1 (Sefer 1)";

/**
 * Pose une chaîne de Tehilim créée par `owner`, telle que l'app l'écrirait :
 * mêmes champs que sessionService.createSession. `selectedBooks` porte des
 * noms de livres (le premier sefer par défaut, 41 psaumes), pas des
 * identifiants de textes.
 */
export async function seedTehilimSession(
  owner: TestAccount,
  options: { books?: string[]; guestEmailRequired?: boolean; name?: string } = {},
): Promise<SeededSession> {
  const id = uniqueId();
  const books = options.books ?? [TEHILIM_SEFER_1];
  const name = options.name ?? `Chaîne de test ${id}`;
  const slug = `chaine-de-test-${id}`;
  await seedDoc("sessions", `session-${id}`, {
    name,
    type: "Tehilim",
    description: "Chaîne posée par la suite de bout en bout.",
    dateLimit: new Date(Date.now() + 7 * DAY),
    createdAt: new Date(),
    personId: owner.uid,
    creatorName: owner.name,
    slug,
    isCompleted: false,
    isEnded: false,
    guestEmailRequired: options.guestEmailRequired ?? false,
    selectedBooks: books,
    reservations: [],
  });
  return { id: `session-${id}`, slug, name };
}
