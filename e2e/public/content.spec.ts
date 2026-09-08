import { test, expect, gotoApp } from "../support/fixtures";

/**
 * Les pages de contenu et d'atterrissage : rendues du même module que le
 * prérendu (src/content/seoPages.ts). On vérifie qu'elles se montent toutes,
 * avec un titre et un seul h1, et sans erreur JavaScript.
 */
const PAGES = [
  "/a-propos",
  "/mentions-legales",
  "/conditions-utilisation",
  "/confidentialite",
  "/finir-le-chass",
  "/partage-tehilim",
  "/tehilim",
  "/tehilim/parnassa",
  "/zmanim",
  "/en/about",
  "/he/about",
];

for (const path of PAGES) {
  test(`${path} se rend`, async ({ page }) => {
    await gotoApp(page, path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page).toHaveTitle(/Petite Jérusalem|פטיט ירושלים/);
  });
}

test("une intention de Tehilim inconnue ne casse pas la page", async ({ page }) => {
  await gotoApp(page, "/tehilim/intention-inconnue");
  await expect(page.locator("#app")).not.toBeEmpty();
});
