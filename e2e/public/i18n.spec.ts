import { test, expect, gotoApp } from "../support/fixtures";

test.describe("langues", () => {
  test("une adresse anglaise impose l'anglais", async ({ page }) => {
    await gotoApp(page, "/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("header nav").getByRole("link", { name: "Library" })).toBeVisible();
  });

  test("une adresse hébraïque passe la page de droite à gauche", async ({ page }) => {
    await gotoApp(page, "/he");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("les horaires traduits ont leur adresse", async ({ page }) => {
    await gotoApp(page, "/en/shabbat-times");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("le sélecteur change la langue et la retient", async ({ page }) => {
    await gotoApp(page, "/");
    // Sur grand écran le sélecteur vit dans le pied de page (et dans le menu
    // replié sur téléphone).
    await page.locator("footer").getByRole("button", { name: "Langue" }).click();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("header nav").getByRole("link", { name: "Library" })).toBeVisible();

    await page.reload();
    await page.locator("#app > *").first().waitFor();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
