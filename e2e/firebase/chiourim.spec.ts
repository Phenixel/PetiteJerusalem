import { test, expect, seedDoc, uniqueId } from "../support/firebase";
import { gotoApp } from "../support/fixtures";

const DAY = 24 * 3600 * 1000;

async function seedChiour(published = true) {
  const id = uniqueId();
  const chiour = {
    slug: `chiour-de-test-${id}`,
    name: `Chiour de test ${id}`,
    description: "Posé par la suite de bout en bout.",
    auteur: `Rav Test ${id.slice(-4)}`,
    categories: ["Emouna"],
    niveau: "Tous niveaux",
    duration: 1800,
    order: 1,
    audioPath: `chiourim/demo/${id}.mp3`,
    mediaUrl: `https://demo.petite-jerusalem.fr/audio/${id}.mp3`,
    fileSize: null,
    published,
    createdAt: new Date(Date.now() - DAY),
    updatedAt: new Date(Date.now() - DAY),
  };
  await seedDoc("chiourim", chiour.slug, chiour);
  return chiour;
}

test.describe("chiourim", () => {
  test("un chiour publié se liste, se cherche et s'ouvre", async ({ page }) => {
    const chiour = await seedChiour();
    await gotoApp(page, "/chiourim");
    await expect(page.getByText(chiour.name).first()).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder("Rechercher un cours, un rav...").fill("rien de tel ici");
    await expect(page.getByText("Aucun chiour ne correspond à votre recherche.")).toBeVisible();
    await page.getByPlaceholder("Rechercher un cours, un rav...").fill(chiour.name);
    await page.getByText(chiour.name).first().click();

    await expect(page).toHaveURL(new RegExp(`/chiourim/${chiour.slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(chiour.name);
    await expect(page.getByText(chiour.auteur).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Lecture" }).first()).toBeVisible();
  });

  test("un brouillon n'apparaît pas", async ({ page }) => {
    const draft = await seedChiour(false);
    const shown = await seedChiour(true);
    await gotoApp(page, "/chiourim");
    await expect(page.getByText(shown.name).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(draft.name)).toHaveCount(0);
  });

  test("un chiour inconnu affiche son message", async ({ page }) => {
    await gotoApp(page, "/chiourim/nexiste-pas");
    await expect(page.getByText("Ce chiour n'a pas été trouvé.")).toBeVisible({ timeout: 20_000 });
  });
});
