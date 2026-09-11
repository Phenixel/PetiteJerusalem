import { test, expect, seedDoc, uniqueId } from "../support/firebase";
import { gotoApp } from "../support/fixtures";

/**
 * La recherche unique : une page qui cherche tout. Les sources embarquées
 * (textes, villes, fêtes, pages) et le texte des Tehilim n'ont pas besoin de
 * Firebase, mais la page charge aussi les chaînes de lecture et les chiourim
 * dès la première frappe : sans émulateur, Firestore journalise son échec,
 * ce que le filet des fixtures compte comme une erreur. D'où la suite
 * Firebase, où l'on vérifie du même coup que ces deux sources répondent.
 */

const DAY = 24 * 3600 * 1000;

async function seedSession() {
  const id = uniqueId();
  const session = {
    name: `Chaîne de test ${id}`,
    slug: `chaine-de-test-${id}`,
    type: "Tehilim",
    description: "Posée par la suite de bout en bout.",
    dateLimit: new Date(Date.now() + 30 * DAY),
    createdAt: new Date(Date.now() - DAY),
    personId: `creator-${id}`,
    creatorName: `Créatrice ${id.slice(-4)}`,
    reservations: [],
  };
  await seedDoc("sessions", `session-${id}`, session);
  return session;
}

async function seedChiour() {
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
    published: true,
    createdAt: new Date(Date.now() - DAY),
    updatedAt: new Date(Date.now() - DAY),
  };
  await seedDoc("chiourim", chiour.slug, chiour);
  return chiour;
}

test.describe("recherche unique", () => {
  test("l'accueil mène à la recherche avec ce qu'on a tapé", async ({ page }) => {
    await gotoApp(page, "/");
    const launcher = page.getByPlaceholder("Rechercher dans Petite Jérusalem…");
    await expect(launcher).toBeVisible();
    await launcher.fill("Berakhot");
    await launcher.press("Enter");
    await expect(page).toHaveURL(/\/recherche\?q=Berakhot$/);
    await expect(page.getByRole("heading", { level: 1, name: "Recherche" })).toBeVisible();
    await expect(page.locator('a[href="/bibliotheque/talmud/berakhot"]')).toBeVisible();
  });

  test("trouve un texte, une ville, une fête et une page au même endroit", async ({ page }) => {
    await gotoApp(page, "/recherche");
    const search = page.getByPlaceholder("Rechercher un texte, une chaîne, un chiour…");
    await expect(search).toBeVisible();

    await search.fill("marseille");
    await expect(page.locator('a[href="/horaires/marseille"]')).toBeVisible();

    await search.fill("pessah");
    await expect(page.locator('a[href="/calendrier/pessah"]')).toBeVisible();

    await search.fill("lecture du jour");
    await expect(page.locator('a[href="/bibliotheque/lecture-du-jour"]')).toBeVisible();
  });

  test("trouve une chaîne de lecture et un chiour", async ({ page }) => {
    const session = await seedSession();
    const chiour = await seedChiour();
    await gotoApp(page, "/recherche");
    const search = page.getByPlaceholder("Rechercher un texte, une chaîne, un chiour…");

    await search.fill(session.name);
    await expect(page.locator(`a[href="/share-reading/session/${session.slug}"]`)).toBeVisible({
      timeout: 20_000,
    });

    await search.fill(chiour.auteur);
    await expect(page.locator(`a[href="/chiourim/${chiour.slug}"]`)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("cherche dans le texte des Tehilim, en hébreu", async ({ page }) => {
    await gotoApp(page, "/recherche?q=אשרי האיש");
    // Le psaume 1 commence ainsi : le lecteur s'ouvre sur sa première ligne.
    await expect(page.locator('a[href="/bibliotheque/tehilim/1?verset=0"]')).toBeVisible({
      timeout: 20_000,
    });
  });

  test("dit quand rien ne correspond", async ({ page }) => {
    await gotoApp(page, "/recherche?q=xyzxyzxyz");
    await expect(page.getByText("Rien ne correspond à")).toBeVisible({ timeout: 20_000 });
  });
});
