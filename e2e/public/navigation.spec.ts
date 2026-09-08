import { test, expect, gotoApp } from "../support/fixtures";

test.describe("navigation", () => {
  test("une adresse inconnue tombe sur la page 404", async ({ page }) => {
    await gotoApp(page, "/cette-page-n-existe-pas");
    await expect(page.getByText("404")).toBeVisible();
    await page.getByRole("link", { name: /Accueil/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("les pages protégées renvoient à la connexion en gardant la destination", async ({
    page,
  }) => {
    for (const path of ["/profile", "/bibliotheque/lecture-du-jour", "/session-management/x"]) {
      await gotoApp(page, path);
      // La destination peut être encodée ou non selon le chemin qui l'a posée.
      await expect(page).toHaveURL(
        new RegExp(
          `/login\\?redirect=(${encodeURIComponent(path)}|${path.replace(/\//g, "\\/")})$`,
        ),
      );
    }
  });

  test("le lien de connexion de la barre mène au formulaire", async ({ page }) => {
    await gotoApp(page, "/");
    await page.locator("header nav").getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/login(\?redirect=%2F)?$/);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    // Bascule inscription : le pseudo et la confirmation apparaissent.
    await page.getByRole("button", { name: "Créer un compte" }).click();
    await expect(page.locator("#displayName")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();
  });

  test("retour arrière : la bibliothèque retrouve sa position de défilement", async ({ page }) => {
    await gotoApp(page, "/bibliotheque/tehilim");
    const target = page.locator('a[href="/bibliotheque/tehilim/60"]');
    await target.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(200);
    await target.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tehilim 60");
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Tehilim" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeGreaterThan(before - 300);
  });
});
