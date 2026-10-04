import { test, expect, createAccount, signIn, uniqueId } from "../support/firebase";
import { gotoApp } from "../support/fixtures";
import { AUTH_PORT, PROJECT_ID } from "../../scripts/lib/firebase-emulator.mjs";

/** Les emails de réinitialisation que l'émulateur Auth a « envoyés » à `email`. */
async function resetEmailsTo(email: string): Promise<unknown[]> {
  const res = await fetch(
    `http://localhost:${AUTH_PORT}/emulator/v1/projects/${PROJECT_ID}/oobCodes`,
  );
  const { oobCodes = [] } = (await res.json()) as {
    oobCodes?: { email: string; requestType: string }[];
  };
  return oobCodes.filter((code) => code.email === email && code.requestType === "PASSWORD_RESET");
}

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

  test("un mot de passe oublié se réinitialise par email, sans dire qui a un compte", async ({
    page,
  }) => {
    const account = await createAccount("oubli");
    const stranger = `inconnu-${uniqueId()}@example.com`;
    await gotoApp(page, "/login");

    // Le mot de passe refusé : la sortie est sous le champ.
    await page.locator("#email").fill(account.email);
    await page.locator("#password").fill("pas-le-bon");
    await page.locator('form button[type="submit"]').click();
    await page.getByRole("button", { name: "Mot de passe oublié" }).click();
    await expect(page.locator("#email")).toHaveValue(account.email);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    const sent = page.getByRole("status").filter({ hasText: "un email vient d'y partir" });
    await expect(sent).toContainText(account.email);
    await expect.poll(() => resetEmailsTo(account.email)).toHaveLength(1);

    // Une adresse sans compte reçoit la même réponse, et rien ne part.
    await page.locator("#email").fill(stranger);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(sent).toContainText(stranger);
    await expect(page.locator('form [class*="text-red"]')).toHaveCount(0);
    expect(await resetEmailsTo(stranger)).toHaveLength(0);

    await page.getByRole("button", { name: "Retour à la connexion" }).click();
    await expect(page.locator("#password")).toBeVisible();
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

  test("un compte gardé dans IndexedDB par une version précédente reste connecté", async ({
    page,
  }) => {
    // Le site garde désormais le compte dans localStorage (src/firebase/core.ts).
    // Les versions précédentes le gardaient dans IndexedDB : on remet le compte
    // là où elles le laissaient, et le rechargement doit le retrouver.
    const account = await createAccount("idb");
    await signIn(page, account, "/profile");
    const key = await page.evaluate(async () => {
      const found = Object.keys(localStorage).find((k) => k.startsWith("firebase:authUser:"));
      if (!found) return null;
      const value = JSON.parse(localStorage.getItem(found)!);
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("firebaseLocalStorageDb", 1);
        open.onupgradeneeded = () =>
          open.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("firebaseLocalStorage", "readwrite");
          tx.objectStore("firebaseLocalStorage").put({ fbase_key: found, value });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
      localStorage.removeItem(found);
      return found;
    });
    expect(key).toMatch(/^firebase:authUser:/);

    await page.reload();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(account.name);
    // Retrouvé, le compte est passé dans localStorage.
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k!) !== null, key))
      .toBe(true);
  });
});
