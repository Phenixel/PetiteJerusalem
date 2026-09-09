import { test, expect, gotoApp } from "../support/fixtures";

test.describe("accueil visiteur", () => {
  test("se rend avec sa navigation et son pied de page", async ({ page }) => {
    await gotoApp(page, "/");
    await expect(page).toHaveTitle(/Petite Jérusalem/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    const nav = page.locator("header nav");
    await expect(nav.getByRole("link", { name: "Partage de lectures" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Bibliothèque" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Chiourim" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Se connecter" })).toBeVisible();

    await expect(page.locator("footer")).toBeVisible();
    // Un seul h1 par page (lecteurs d'écran, référencement).
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("la carte des horaires arrive après le rendu, sans erreur", async ({ page }) => {
    await gotoApp(page, "/");
    // Chargée à la demande (hebcal) : elle se pose quelques instants après,
    // avec au moins un horaire au format HH:MM.
    await expect(
      page
        .locator("main")
        .getByText(/\b\d{1,2}:\d{2}\b/)
        .first(),
    ).toBeVisible({
      timeout: 15_000,
    });
  });

  test("le menu mobile s'ouvre et se referme", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, "/");
    const burger = page.getByRole("button", { name: "Menu principal" });
    await burger.click();
    const mobileLink = page.getByRole("link", { name: "Bibliothèque" }).last();
    await expect(mobileLink).toBeVisible();
    await mobileLink.click();
    await expect(page).toHaveURL(/\/bibliotheque$/);
    await expect(page.getByRole("heading", { level: 1, name: "Bibliothèque" })).toBeVisible();
  });
});

test.describe("bannière de consentement", () => {
  test.use({ consent: "ask" });

  test("se montre une fois, et retient le choix", async ({ page }) => {
    await gotoApp(page, "/");
    const banner = page.getByText("Mesure d'audience");
    await expect(banner).toBeVisible();
    await page.getByRole("button", { name: "Refuser" }).click();
    await expect(banner).toBeHidden();

    await page.reload();
    await page.locator("#app > *").first().waitFor();
    await expect(page.getByText("Mesure d'audience")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("pj_analytics_consent"))).toBe("denied");
  });
});
