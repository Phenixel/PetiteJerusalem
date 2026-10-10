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

  test("l'ancienne adresse des Sli'hot mène à leur page dans les Moadim", async ({ page }) => {
    await gotoApp(page, "/bibliotheque/slihot");
    await expect(page).toHaveURL(/\/bibliotheque\/moadim\/slihot$/);
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

  test("la guemara et la Torah s'ouvrent dans la forme de leur page", async ({ page }) => {
    // La page de Vilna : la guemara au centre, Rachi et Tossafot autour.
    await gotoApp(page, "/bibliotheque/talmud/berakhot/1");
    await page.getByRole("button", { name: "Page", exact: true }).first().click();
    const daf = page.locator(".daf-page").first();
    await expect(daf).toBeVisible({ timeout: 20_000 });
    await expect(daf.locator(".daf-lead").first()).toBeVisible({ timeout: 20_000 });
    // Le choix est gardé : la Torah s'ouvre à son tour dans le Sefer Torah.
    await gotoApp(page, "/bibliotheque/tanakh/haazinu");
    await expect(page.locator(".torah-scroll")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".scroll-row-2").first()).toBeVisible();
    await page.getByRole("button", { name: "Hébreu", exact: true }).first().click();
    await expect(page.locator(".torah-scroll")).toHaveCount(0);
  });

  test("un passage de guemara ouvre ses commentaires, qui suivent la lecture", async ({ page }) => {
    await gotoApp(page, "/bibliotheque/talmud/berakhot/1");
    const passages = page.locator(".daf-passage");
    await expect(passages.first()).toBeVisible({ timeout: 20_000 });
    // Le premier passage : Rachi et Tossafot, annoncés dans la bulle.
    await passages.nth(0).click();
    const rangee = page.locator(".bubble-commentary");
    await expect(rangee).toContainText("Rachi 2 · Tossafot 1", { timeout: 20_000 });
    await rangee.click();
    const panneau = page.locator(".commentary-panel");
    await expect(panneau).toContainText("Daf 2a · passage 1");
    await expect(panneau).toContainText("Tossafot");
    // Le panneau ouvert, un autre passage y passe, sans bulle.
    await passages.nth(2).click();
    await expect(panneau).toContainText("Daf 2a · passage 3");
    await expect(page.locator(".reading-bubble")).toHaveCount(0);
    await expect(page.locator(".lead-mark").first()).toBeVisible();
    await panneau.getByRole("button", { name: "Fermer" }).click();
    await expect(panneau).toHaveCount(0);
  });

  test("l'ancienne adresse /lire/:id mène au texte, pas à une page vide", async ({ page }) => {
    // 103 est l'identifiant du Tehilim 1 (src/datas/textStudies.json).
    await gotoApp(page, "/lire/103");
    await expect(page).toHaveURL(/\/bibliotheque\/tehilim\/1$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tehilim 1");
    await expect(page.locator('[dir="rtl"].reading-he').first()).toBeVisible();
  });

  test("« Reprendre » amène au verset d'un autre chapitre, et ne déplace pas la reprise", async ({
    page,
  }) => {
    // Shir Hashirim (id 331), une lecture laissée au chapitre 3, verset 9.
    // Le chapitre est dans le même fichier que la liste : le défilement du
    // routeur vers le haut annulait celui vers le verset, et le défilement
    // doux, pris pour un geste, enregistrait le haut de l'écran à sa place.
    const saved = {
      textId: "331",
      section: 3,
      line: 8,
      path: "/bibliotheque/tanakh/shir-hashirim/3",
      label: "Shir Hashirim · Chapitre 3",
      at: Date.now(),
    };
    await page.addInitScript((position) => {
      localStorage.setItem("pj-reading-positions", JSON.stringify({ "331": position }));
    }, saved);
    await gotoApp(page, "/bibliotheque/tanakh/shir-hashirim");
    await page.getByRole("button", { name: "Reprendre", exact: true }).click();

    await expect(page).toHaveURL(/\/shir-hashirim\/3\?verset=8$/);
    await expect(page.locator('[data-line="8"]').first()).toBeInViewport({ timeout: 5_000 });
    // Le temps que le défilement doux finisse et que la capture (600 ms
    // après le dernier défilement) ait pu passer : c'est elle qui écrasait.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2_000)));
    const stored = await page.evaluate(
      () => JSON.parse(localStorage.getItem("pj-reading-positions") ?? "{}")["331"],
    );
    expect(stored).toMatchObject({ section: 3, line: 8 });
  });

  test("« Reprendre » ouvre le chapitre en haut quand le verset n'y est pas", async ({ page }) => {
    // Une reprise dont la ligne n'existe pas dans le chapitre (c'est le cas de
    // toute reprise dans la Guemara, sans lignes repérées) : le routeur ne
    // remonte plus pour une arrivée sur un verset, c'est donc au lecteur de
    // le faire, sans quoi le chapitre s'ouvrait à la hauteur de la liste.
    const saved = {
      textId: "331",
      section: 3,
      line: 999,
      path: "/bibliotheque/tanakh/shir-hashirim/3",
      label: "Shir Hashirim · Chapitre 3",
      at: Date.now(),
    };
    await page.addInitScript((position) => {
      localStorage.setItem("pj-reading-positions", JSON.stringify({ "331": position }));
    }, saved);
    await page.setViewportSize({ width: 390, height: 420 });
    await gotoApp(page, "/bibliotheque/tanakh/shir-hashirim");
    const resume = page.getByRole("button", { name: "Reprendre", exact: true });
    await expect(resume).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 150));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    // Le clic du DOM, et non celui de Playwright, qui ramènerait d'abord le
    // bouton à l'écran et remonterait la page à notre place.
    await resume.evaluate((button) => (button as HTMLElement).click());

    await expect(page).toHaveURL(/\/shir-hashirim\/3\?verset=999$/);
    await expect(page.locator('[data-line="0"]').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});
