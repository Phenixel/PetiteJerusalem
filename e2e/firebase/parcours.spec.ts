import type { Page } from "playwright/test";
import { test, expect, createAccount, readDoc, seedDoc, signIn } from "../support/firebase";

type ParcoursDoc = {
  objectives?: Record<string, { kind?: string; textId?: number; preset?: string }>;
  days?: Record<string, { done?: string[] }>;
};
type Prefs = {
  dailyReadingIds?: number[];
  dailyReadingProgress?: { completedIds?: number[] };
};

/** Le jour local, comme l'app l'écrit (localDayKey), décalé de `offset` jours. */
function todayKey(offset = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offset);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

test.describe("Mon parcours", () => {
  test("un texte du jour se prend, se coche, et suit le compte", async ({ page }) => {
    const account = await createAccount("parcours");
    await signIn(page, account, "/parcours/nouveau");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Que voulez-vous accomplir",
    );

    // Un texte chaque jour : le Tehilim 1.
    await page.getByRole("button", { name: /Un texte chaque jour/ }).click();
    await page.getByPlaceholder(/Un texte/).fill("Tehilim 1");
    await page
      .getByRole("button", { name: /^Tehilim 1\b/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Ajouter 1 texte" }).click();

    // Pris, il arrive sur Mon parcours, sur l'étagère.
    await expect(page).toHaveURL(/\/parcours$/);
    await expect(page.getByText("Tehilim 1 est sur votre étagère.")).toBeAttached();

    // Le compte le porte, et la lecture du jour d'avant aussi (les versions
    // installées, le rappel du soir la lisent encore).
    await expect
      .poll(async () => {
        const doc = (await readDoc("parcours", account.uid)) as ParcoursDoc | null;
        return doc?.objectives?.["daily-text-103"]?.textId ?? null;
      })
      .toBe(103);
    await expect
      .poll(
        async () =>
          ((await readDoc("userPreferences", account.uid)) as Prefs | null)?.dailyReadingIds ?? [],
      )
      .toContain(103);

    // L'accueil : la carte des textes du jour en tête de la pile, nommée
    // d'après eux (que des psaumes) ; sa fiche (clic droit) la coche.
    await page.goto("/");
    await page.getByLabel(/^Mes Tehilim,.*appui long pour la fiche/).click({ button: "right" });
    const sheet = page.getByRole("dialog", { name: "Mes Tehilim" });
    await sheet.getByRole("button", { name: "C'est fait", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect
      .poll(async () => {
        const doc = (await readDoc("parcours", account.uid)) as ParcoursDoc | null;
        return doc?.days?.[todayKey()]?.done ?? [];
      })
      .toContain("daily-text-103");
    await expect
      .poll(
        async () =>
          ((await readDoc("userPreferences", account.uid)) as Prefs | null)?.dailyReadingProgress
            ?.completedIds ?? [],
      )
      .toContain(103);
  });

  test("un modèle se confirme avant de s'ajouter, et ne se prend qu'une fois", async ({ page }) => {
    const account = await createAccount("modele");
    await signIn(page, account, "/parcours/nouveau");
    const tefilot = page.getByRole("button", { name: "Les trois tefilot", exact: true });

    // Le toucher ouvre la feuille du modèle ; rien n'est encore ajouté.
    await tefilot.click();
    const sheet = page.getByRole("dialog", { name: "Les trois tefilot" });
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/\/parcours\/nouveau$/);
    await sheet.getByRole("button", { name: "Annuler" }).click();
    await expect(sheet).toBeHidden();

    // Confirmé : l'habitude est prise, une seule fois, et arrive dans la liste.
    await tefilot.click();
    await sheet.getByRole("button", { name: "Ajouter à mon parcours" }).click();
    await expect(page).toHaveURL(/\/parcours$/);
    await expect(page.getByText("Les trois tefilot est dans vos habitudes.")).toBeAttached();
    await expect(page.getByRole("link", { name: /^Les trois tefilot/ })).toBeVisible();
    await expect
      .poll(async () => {
        const doc = (await readDoc("parcours", account.uid)) as ParcoursDoc | null;
        return Object.values(doc?.objectives ?? {}).filter((o) => o.preset === "tefilot").length;
      })
      .toBe(1);

    // De retour sur la liste, il n'est plus proposé.
    await page.goto("/parcours/nouveau");
    await expect(page.getByRole("button", { name: "Chema al hamita", exact: true })).toBeVisible();
    await expect(tefilot).toHaveCount(0);
  });

  test("un volume se choisit sur une seule page, et arrive sur l'étagère", async ({ page }) => {
    const account = await createAccount("volume");
    await signIn(page, account, "/parcours/nouveau");

    // La Michna : sa partie se choisit dessous, sur la même page.
    await page.getByRole("button", { name: "Michna", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(
      "Quelle partie de la Michna ?",
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Que voulez-vous accomplir",
    );
    await page.getByRole("button", { name: "Zeraïm", exact: true }).click();
    await page.getByRole("button", { name: "Suivant", exact: true }).click();
    await expect(page.getByRole("heading", { name: /d'ici quand/ })).toBeVisible();
    await expect(page).toHaveURL(/\/parcours\/nouveau$/);

    // Posé : il arrive sur l'étagère de Mon parcours, le soir d'office.
    await page.getByRole("button", { name: "Poser le volume sur l'étagère" }).click();
    await expect(page).toHaveURL(/\/parcours$/);
    await expect(page.getByText(/est sur votre étagère\.$/)).toBeAttached();
    await expect
      .poll(async () => {
        const doc = (await readDoc("parcours", account.uid)) as {
          objectives?: Record<string, { kind?: string; corpus?: string; anchor?: string }>;
        } | null;
        return Object.values(doc?.objectives ?? {}).find((o) => o.kind === "program") ?? null;
      })
      .toMatchObject({ corpus: "michna", anchor: "arvit" });
  });

  test("sur l'accueil, un volume ouvre sa lecture ; le clic droit, sa page", async ({ page }) => {
    const account = await createAccount("volume-accueil");
    await signIn(page, account, "/parcours/nouveau");
    await page.getByRole("button", { name: "Michna", exact: true }).click();
    await page.getByRole("button", { name: "Zeraïm", exact: true }).click();
    await page.getByRole("button", { name: "Suivant", exact: true }).click();
    await page.getByRole("button", { name: "Poser le volume sur l'étagère" }).click();
    await expect(page).toHaveURL(/\/parcours$/);

    // Toucher le volume : la portion du jour, dans le lecteur, rattachée au programme.
    await page.goto("/");
    const volume = page.locator(".volume-shelf").getByRole("link", { name: /^Séder Zeraïm, / });
    await volume.click();
    await expect(page).toHaveURL(/\/bibliotheque\/michna\/.+\?objectif=/);

    // Le clic droit : sa page, et ses réglages.
    await page.goto("/");
    await volume.click({ button: "right" });
    await expect(page).toHaveURL(/\/parcours\/objectif\/[^/]+$/);
  });

  test("la série qui franchit un palier allume une lumière, une fois", async ({ page }) => {
    // Six jours d'affilée jusqu'à hier ; le septième allume la lanterne.
    const account = await createAccount("lumiere");
    const now = Date.now();
    const days: Record<string, { done: string[]; at: number }> = {};
    for (let i = 1; i <= 6; i++) days[todayKey(-i)] = { done: ["serie-langue"], at: now };
    await seedDoc("parcours", account.uid, {
      v: 1,
      objectives: {
        "serie-langue": {
          id: "serie-langue",
          kind: "habit",
          preset: "chmirat-halachon",
          name: "",
          days: [0, 1, 2, 3, 4, 5, 6],
          moment: "anytime",
          since: todayKey(-7),
          createdAt: now,
          updatedAt: now,
        },
      },
      days,
    });
    // L'appareil a déjà vu ces six jours : seul le palier franchi se fête.
    await page.addInitScript(() => {
      if (!localStorage.getItem("pj_parcours_light_seen")) {
        localStorage.setItem("pj_parcours_light_seen", "6");
      }
    });
    await signIn(page, account, "/");

    await page
      .getByLabel(/^Garder ma langue,.*appui long pour la fiche/)
      .click({ button: "right" });
    await page.getByRole("button", { name: "C'est fait", exact: true }).click();
    const light = page.getByRole("dialog", { name: "Une nouvelle lumière" });
    await expect(light).toBeVisible();
    await expect(light).toContainText("La lanterne");
    await light.getByRole("button", { name: "Continuer" }).click();
    await expect(light).toBeHidden();

    // Fêtée, elle est notée sur l'appareil : elle ne se fêtera plus.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("pj_parcours_light_seen")))
      .toBe("7");
  });

  test("plusieurs textes d'affilée, lus à la suite dans la lecture du jour", async ({ page }) => {
    const account = await createAccount("lecture");
    await signIn(page, account, "/parcours/nouveau");
    await page.getByRole("button", { name: /Un texte chaque jour/ }).click();
    const search = page.getByPlaceholder(/Un texte/);
    await search.fill("Tehilim 1");
    await page
      .getByRole("button", { name: /^Tehilim 1\b/ })
      .first()
      .click();
    await search.fill("Tehilim 23");
    await page
      .getByRole("button", { name: /^Tehilim 23\b/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Ajouter 2 textes" }).click();
    await expect(page).toHaveURL(/\/parcours$/);

    // L'accueil : une seule carte, « Mes Tehilim » (que des psaumes), qui
    // ouvre la page, « Mes Tehilim journaliers ».
    await page.goto("/");
    await page
      .getByRole("link", { name: /^Mes Tehilim,/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/bibliotheque\/lecture-du-jour$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Mes Tehilim journaliers" }),
    ).toBeVisible();
    await expect(page.getByText("0 sur 2 lus aujourd'hui")).toBeVisible();

    // Le premier texte, marqué lu : la journée le porte.
    await page.getByRole("button", { name: "Marquer comme lu" }).first().click();
    await expect(page.getByText("1 sur 2 lus aujourd'hui")).toBeVisible();
    await expect
      .poll(async () => {
        const doc = (await readDoc("parcours", account.uid)) as ParcoursDoc | null;
        return (doc?.days?.[todayKey()]?.done ?? []).length;
      })
      .toBe(1);

    // La liste se compose sur la page : un texte retiré, un autre ajouté.
    await page.getByRole("button", { name: "Modifier ma liste" }).click();
    await page.getByRole("button", { name: "Retirer Tehilim 23" }).click();
    await expect(page.getByText("Tout est lu pour aujourd'hui.")).toBeVisible();
    await page.getByPlaceholder(/Un texte/).fill("Tehilim 121");
    await page
      .getByRole("button", { name: /^Tehilim 121\b/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Ajouter 1 texte" }).click();
    await expect(page.getByText("1 sur 2 lus aujourd'hui")).toBeVisible();
  });

  test("les anciennes adresses mènent à la lecture du jour et à l'accueil", async ({ page }) => {
    // Les widgets, le rappel du soir et les versions installées y mènent encore.
    const account = await createAccount("ancienne");
    await signIn(page, account, "/bibliotheque/lecture-du-jour");
    await expect(page.getByRole("heading", { level: 1, name: "Lecture du jour" })).toBeVisible();
    await page.goto("/parcours/journee");
    await expect(page).toHaveURL(/\/$/);
  });
});

/**
 * Un doigt qui glisse, en événements tactiles bruts : ils passent par le
 * défilement de Chromium comme ceux d'un téléphone (les gestes synthétiques,
 * eux, ne font pas défiler la page).
 */
async function finger(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  const steps = 20;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y }],
  });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps }],
    });
    // Le rythme d'un doigt, une image à la fois : un geste, pas une attente.
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test.describe("l'accueil au doigt", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("la page défile sous le doigt, même sur la pile ; tirée en haut de page, elle se déplie", async ({
    page,
  }) => {
    const account = await createAccount("pile");
    const now = Date.now();
    const habit = (id: string, preset: string) => ({
      id,
      kind: "habit",
      preset,
      name: "",
      days: [0, 1, 2, 3, 4, 5, 6],
      moment: "anytime",
      since: todayKey(),
      createdAt: now,
      updatedAt: now,
    });
    await seedDoc("parcours", account.uid, {
      v: 1,
      objectives: {
        "pile-langue": habit("pile-langue", "chmirat-halachon"),
        "pile-chema": habit("pile-chema", "chema-al-hamita"),
        "pile-repas": habit("pile-repas", "birkat-hamazon"),
      },
      days: {},
    });
    await signIn(page, account, "/");
    // La carte du dessus, au libellé qui dit ses gestes.
    const top = page.getByLabel(/vers le bas pour toute la journée/);
    await expect(top).toBeVisible();
    const fold = page.getByRole("button", { name: "Replier", exact: true });
    const scrollY = () => page.evaluate(() => window.scrollY);
    const onTop = async () => {
      const box = (await top.boundingBox())!;
      return { x: box.x + 90, y: box.y + 60 };
    };

    // Le doigt posé sur la carte, vers le haut : la page défile, la pile reste.
    await finger(page, await onTop(), 0, -320);
    await expect.poll(scrollY).toBeGreaterThan(100);
    await expect(fold).toBeHidden();

    // En haut de page, tirée vers le bas : la pile se déplie en portefeuille.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(scrollY).toBe(0);
    await finger(page, await onTop(), 0, 150);
    await expect(fold).toBeVisible();

    // Le portefeuille ouvert défile, lui aussi, sous le doigt.
    const card = (await page
      .getByLabel(/glisser à droite si c'est fait/)
      .nth(1)
      .boundingBox())!;
    await finger(page, { x: card.x + 150, y: card.y + 30 }, 0, -320);
    await expect.poll(scrollY).toBeGreaterThan(100);
    await expect(fold).toBeAttached();

    // Replié, la carte glissée à droite au doigt est faite.
    await page.evaluate(() => window.scrollTo(0, 0));
    await fold.click();
    await expect(page.getByRole("button", { name: /^Ma journée, 0\ssur\s3/ })).toBeVisible();
    await finger(page, { x: 60, y: (await onTop()).y }, 200, 4);
    await expect(page.getByRole("button", { name: /^Ma journée, 1\ssur\s3/ })).toBeVisible();
  });
});
