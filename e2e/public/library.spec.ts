import { test, expect, gotoApp } from "../support/fixtures";

test.describe("bibliothèque", () => {
  test("présente les corpus et mène aux Tehilim", async ({ page }) => {
    await gotoApp(page, "/bibliotheque");
    await expect(page.getByRole("heading", { level: 1, name: "Bibliothèque" })).toBeVisible();
    for (const corpus of ["tehilim", "michna", "talmud", "tanakh", "sidour", "brahot"]) {
      await expect(page.locator(`a[href="/bibliotheque/${corpus}"]`).first()).toBeVisible();
    }
    await page.locator('a[href="/bibliotheque/tehilim"]').first().click();
    await expect(page).toHaveURL(/\/bibliotheque\/tehilim$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tehilim" })).toBeVisible();
  });

  test("la recherche filtre les textes d'un corpus", async ({ page }) => {
    await gotoApp(page, "/bibliotheque/tehilim");
    const search = page.getByPlaceholder("Rechercher un tehilim…");
    await expect(search).toBeVisible();
    await search.fill("150");
    // Filtrage différé (150 ms après la dernière frappe).
    await expect(page.locator('a[href^="/bibliotheque/tehilim/"]')).toHaveCount(1, {
      timeout: 5_000,
    });
    await search.fill("aucun texte de ce nom");
    await expect(page.getByText("Aucun texte ne correspond à votre recherche.")).toBeVisible();
  });

  test("les Sli'hot s'ouvrent directement sur le texte", async ({ page }) => {
    await gotoApp(page, "/bibliotheque/slihot");
    await expect(page).toHaveURL(/\/bibliotheque\/slihot\/slihot$/);
  });

  test("l'ancienne page des téléchargements ramène à la bibliothèque", async ({ page }) => {
    await gotoApp(page, "/telechargements");
    await expect(page).toHaveURL(/\/bibliotheque$/);
  });
});

test.describe("lecteur", () => {
  test("ouvre un psaume, en hébreu puis en phonétique", async ({ page }) => {
    await gotoApp(page, "/bibliotheque/tehilim");
    await page.locator('a[href="/bibliotheque/tehilim/1"]').first().click();
    await expect(page).toHaveURL(/\/bibliotheque\/tehilim\/1$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tehilim 1");

    const hebrew = page.locator('[dir="rtl"].reading-he').first();
    await expect(hebrew).toBeVisible();
    // Le texte porte voyelles et cantillation : on vérifie des lettres, pas
    // une graphie exacte.
    await expect(hebrew).toContainText(/א.*ש.*ר/);

    await page.getByRole("button", { name: "Phonétique" }).click();
    await expect(hebrew).toBeHidden();
    await expect(page.getByText(/Achr[eé]/i).first()).toBeVisible();
  });

  test("passe au texte suivant, et « retour » ramène à la liste", async ({ page }) => {
    await gotoApp(page, "/bibliotheque/tehilim");
    await page.locator('a[href="/bibliotheque/tehilim/1"]').first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tehilim 1");
    await page
      .getByRole("button", { name: /Tehilim 2/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/tehilim\/2$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tehilim 2");
    // Feuilleter remplace l'entrée d'historique : le retour rend la liste
    // d'où l'on vient, pas le psaume précédent (voir TextReadingPage).
    await page.goBack();
    await expect(page).toHaveURL(/\/bibliotheque\/tehilim$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tehilim" })).toBeVisible();
  });

  test("un texte inconnu ne casse pas la page", async ({ page }) => {
    await gotoApp(page, "/bibliotheque/tehilim/999");
    await expect(page.locator("#app")).not.toBeEmpty();
    await expect(page.getByRole("link", { name: /Bibliothèque/ }).first()).toBeVisible();
  });

  test("un traité du Talmud ouvre sur ses chapitres, puis sur un daf", async ({ page }) => {
    await gotoApp(page, "/bibliotheque/talmud");
    const first = page.locator('a[href^="/bibliotheque/talmud/"]').first();
    await expect(first).toBeVisible();
    await first.click();
    // Un texte à plusieurs sections s'ouvre sur la liste de ses chapitres.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Berakhot");
    const chapter = page.getByRole("button", { name: /Chapitre 1/ }).first();
    await expect(chapter).toBeVisible();
    await chapter.click();
    await expect(page).toHaveURL(/\/bibliotheque\/talmud\/berakhot\/1$/);
    await expect(page.locator('[dir="rtl"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Daf 2a/).first()).toBeVisible();
  });

  test("l'ancienne adresse /lire/:id mène au texte, pas à une page vide", async ({ page }) => {
    // 103 est l'identifiant du Tehilim 1 (src/datas/textStudies.json).
    await gotoApp(page, "/lire/103");
    await expect(page).toHaveURL(/\/bibliotheque\/tehilim\/1$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tehilim 1");
    await expect(page.locator('[dir="rtl"].reading-he').first()).toBeVisible();
  });
});
