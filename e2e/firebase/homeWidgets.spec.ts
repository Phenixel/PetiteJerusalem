import { test, expect, createAccount, readDoc, signIn } from "../support/firebase";

// Les widgets de l'accueil (voir services/homeWidgets) : on en ajoute un, on
// le monte en tête, on enregistre, et l'ordre tient après un rechargement.
test.describe("widgets de l'accueil", () => {
  test("se choisissent, se rangent et suivent le compte", async ({ page }) => {
    const account = await createAccount("accueil");
    await signIn(page, account, "/");

    // L'accueil d'origine : la lecture du jour et les horaires.
    await expect(page.getByRole("heading", { name: "Ma lecture quotidienne" })).toBeVisible();

    await page.getByRole("button", { name: "Personnaliser l'accueil" }).click();
    const editor = page.getByRole("dialog");
    await expect(editor).toBeVisible();

    // Le Daf hayomi rejoint l'accueil, en dernier, puis monte en tête.
    await editor.getByRole("button", { name: "Ajouter Daf hayomi" }).click();
    await editor.getByRole("button", { name: "Monter Daf hayomi" }).click();
    await editor.getByRole("button", { name: "Monter Daf hayomi" }).click();
    // Les horaires s'en vont.
    await editor.getByRole("button", { name: "Retirer Prochain horaire" }).click();
    await editor.getByRole("button", { name: "Sauvegarder" }).click();
    await expect(editor).toBeHidden();

    await expect
      .poll(async () => {
        const prefs = (await readDoc("userPreferences", account.uid)) as {
          homeWidgets?: string[];
        } | null;
        return prefs?.homeWidgets ?? null;
      })
      .toEqual(["daf_yomi", "daily_reading"]);

    // Après rechargement, le Daf hayomi passe avant la lecture du jour.
    await page.reload();
    const titles = page.locator("main h3");
    await expect(titles.first()).toContainText("Daf hayomi");
    await expect(page.getByRole("heading", { name: "Ma lecture quotidienne" })).toBeVisible();
  });
});
