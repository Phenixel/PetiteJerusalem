import { test, expect, createAccount, signIn, uniqueId } from "../support/firebase";
import { gotoApp } from "../support/fixtures";

test.describe("compte", () => {
  test("s'inscrit par email et voit son nom dans la barre", async ({ page }) => {
    const id = uniqueId();
    const name = `Nouvelle ${id.slice(-4)}`;
    await gotoApp(page, "/login");
    await page.getByRole("button", { name: "Créer un compte" }).click();
    await page.locator("#displayName").fill(name);
    await page.locator("#email").fill(`inscription-${id}@example.com`);
    await page.locator("#password").fill(`Mdp-${id}`);
    await page.locator("#confirmPassword").fill(`Mdp-${id}`);
    await page.locator('form button[type="submit"]').click();

    await expect(page).toHaveURL(/\/$/);
    // Le pseudo est répercuté tout de suite (pas l'email en attendant).
    await expect(page.locator("header nav").getByRole("link", { name: name })).toBeVisible();

    await page.locator("header nav").getByRole("button", { name: "Déconnexion" }).click();
    await expect(
      page.locator("header nav").getByRole("button", { name: "Se connecter" }),
    ).toBeVisible();
  });

  test("un mauvais mot de passe laisse sur la page avec un message", async ({ page }) => {
    const account = await createAccount("mdp");
    await gotoApp(page, "/login");
    await page.locator("#email").fill(account.email);
    await page.locator("#password").fill("pas-le-bon");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('form [class*="text-red"]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("la connexion ramène à la page demandée", async ({ page }) => {
    const account = await createAccount("redir");
    await signIn(page, account, "/profile");
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(account.name);
  });

  test("le profil permet de changer le nom affiché", async ({ page }) => {
    const account = await createAccount("nom");
    await signIn(page, account, "/profile");
    await page.getByRole("button", { name: "Modifier" }).first().click();
    const input = page.locator('input[type="text"]:visible').first();
    await input.fill(`${account.name} bis`);
    await page.getByRole("button", { name: "Sauvegarder" }).click();
    await expect(page.getByText("Nom d'affichage mis à jour.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`${account.name} bis`);
    await expect(
      page.locator("header nav").getByRole("link", { name: `${account.name} bis` }),
    ).toBeVisible();
  });
});
