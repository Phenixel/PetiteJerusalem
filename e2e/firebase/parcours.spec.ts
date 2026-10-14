import { test, expect, createAccount, readDoc, signIn } from "../support/firebase";

type ParcoursDoc = {
  objectives?: Record<string, { kind?: string; textId?: number }>;
  days?: Record<string, { done?: string[] }>;
};
type Prefs = {
  dailyReadingIds?: number[];
  dailyReadingProgress?: { completedIds?: number[] };
};

/** Le jour local, comme l'app l'écrit (localDayKey). */
function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

test.describe("Mon parcours", () => {
  test("un texte du jour se prend, se coche, et suit le compte", async ({ page }) => {
    const account = await createAccount("parcours");
    await signIn(page, account, "/parcours/nouveau");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nouvel objectif");

    // Un texte chaque jour : le Tehilim 1.
    await page.getByRole("button", { name: /Un texte chaque jour/ }).click();
    await page.getByPlaceholder(/Un texte/).fill("Tehilim 1");
    await page
      .getByRole("button", { name: /^Tehilim 1\b/ })
      .first()
      .click();

    // Le compte le porte, et la lecture du jour d'avant aussi (les versions
    // installées, le rappel du soir la lisent encore).
    await expect
      .poll(async () => {
        const doc = (await readDoc("parcours", account.uid)) as ParcoursDoc | null;
        return doc?.objectives?.["daily-text-103"]?.textId ?? null;
      })
      .toBe(103);
    await expect
      .poll(
        async () =>
          ((await readDoc("userPreferences", account.uid)) as Prefs | null)?.dailyReadingIds ?? [],
      )
      .toContain(103);

    // Ma journée : on le coche.
    await page.goto("/parcours/journee");
    await page.getByRole("button", { name: "Cocher Tehilim 1" }).click();
    await expect(page.getByRole("button", { name: "Décocher Tehilim 1" })).toBeVisible();
    await expect
      .poll(async () => {
        const doc = (await readDoc("parcours", account.uid)) as ParcoursDoc | null;
        return doc?.days?.[todayKey()]?.done ?? [];
      })
      .toContain("daily-text-103");
    await expect
      .poll(
        async () =>
          ((await readDoc("userPreferences", account.uid)) as Prefs | null)?.dailyReadingProgress
            ?.completedIds ?? [],
      )
      .toContain(103);
  });

  test("l'ancienne adresse de la lecture du jour mène à Ma journée", async ({ page }) => {
    const account = await createAccount("ancienne");
    await signIn(page, account, "/bibliotheque/lecture-du-jour");
    await expect(page).toHaveURL(/\/parcours\/journee$/);
  });
});
