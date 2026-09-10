import { test, expect, gotoApp } from "../support/fixtures";

test.describe("horaires", () => {
  test("affiche les horaires d'une ville de l'URL", async ({ page }) => {
    await gotoApp(page, "/horaires/paris");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Paris").first()).toBeVisible();
    // Un horaire au moins, au format HH:MM.
    await expect(
      page
        .locator("main, #app")
        .getByText(/\b\d{1,2}:\d{2}\b/)
        .first(),
    ).toBeVisible();
  });

  test("le sélecteur de ville change le lieu de calcul", async ({ page }) => {
    await gotoApp(page, "/horaires");
    // Le bouton nomme la ville avant ce qu'il ouvre (« Paris, choisir une
    // autre ville ») : c'est la seule mention du lieu de calcul de la page.
    await page.getByRole("button", { name: /choisir une autre ville/i }).click();
    const search = page.getByPlaceholder(/ville/i);
    await search.fill("Marseille");
    await page
      .getByRole("button", { name: /Marseille/ })
      .first()
      .click();
    await expect(page.getByText("Marseille").first()).toBeVisible();
  });

  test("les flèches parcourent les jours", async ({ page }) => {
    await gotoApp(page, "/horaires/paris");
    await page.getByRole("button", { name: "Jour suivant" }).click();
    await expect(page.getByRole("button", { name: /aujourd'hui/i })).toBeVisible();
    await page.getByRole("button", { name: /aujourd'hui/i }).click();
    await expect(page.getByRole("button", { name: /aujourd'hui/i })).toBeHidden();
  });
});

test.describe("calendrier", () => {
  test("liste les fêtes de l'année", async ({ page }) => {
    await gotoApp(page, "/calendrier");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Roch Hachana/i).first()).toBeVisible();
  });

  test("une fête inconnue ramène au calendrier", async ({ page }) => {
    await gotoApp(page, "/calendrier/fete-inconnue");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Roch Hachana/i).first()).toBeVisible();
  });
});

test.describe("paracha", () => {
  test("annonce la paracha de la semaine", async ({ page }) => {
    await gotoApp(page, "/paracha");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("h2").first()).toBeVisible();
  });
});
