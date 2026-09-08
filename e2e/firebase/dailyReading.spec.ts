import { test, expect, createAccount, readDoc, signIn } from "../support/firebase";

test.describe("lecture du jour", () => {
  test("se compose et se coche, et la progression est enregistrée", async ({ page }) => {
    const account = await createAccount("quotidien");
    await signIn(page, account, "/bibliotheque/lecture-du-jour");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ma lecture quotidienne");

    // Liste vide : on passe en mode « gérer » et on ajoute le Tehilim 1.
    await page
      .getByRole("button", { name: /Ajouter des textes|Gérer ma liste/ })
      .first()
      .click();
    await page.getByPlaceholder(/Rechercher/).fill("Tehilim 1");
    await page
      .getByRole("button", { name: /^Tehilim 1\b/ })
      .first()
      .click();
    await expect
      .poll(async () => {
        const prefs = (await readDoc("userPreferences", account.uid)) as {
          dailyReadingIds?: number[];
        } | null;
        return prefs?.dailyReadingIds ?? [];
      })
      .toContain(103);

    // Retour à la lecture : le texte est là, on le marque lu.
    await page.getByRole("button", { name: "Terminé" }).first().click();
    await expect(page.getByText("Tehilim 1").first()).toBeVisible();
    await page.getByRole("button", { name: "Marquer comme lu" }).first().click();
    await expect(page.getByText("Bravo, tout est lu pour aujourd'hui !")).toBeVisible();
    await expect
      .poll(async () => {
        const prefs = (await readDoc("userPreferences", account.uid)) as {
          dailyReadingProgress?: { completedIds?: number[] };
        } | null;
        return prefs?.dailyReadingProgress?.completedIds ?? [];
      })
      .toContain(103);
  });
});
