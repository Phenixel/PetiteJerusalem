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

/** Le jour local, comme l'app l'écrit (localDayKey). */
function todayKey(): string {
  const now = new Date();
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

    // L'accueil : sa carte en tête de la pile ; sa fiche (clic droit) la coche.
    await page.goto("/");
    await page.getByLabel(/^Tehilim\s1,.*appui long pour la fiche/).click({ button: "right" });
    const sheet = page.getByRole("dialog", { name: "Tehilim 1" });
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

    // Confirmé : l'habitude est prise, une seule fois.
    await tefilot.click();
    await sheet.getByRole("button", { name: "Ajouter à mon parcours" }).click();
    await expect(page).toHaveURL(/\/parcours\/objectif\//);
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

  test("les anciennes adresses de la journée mènent à l'accueil", async ({ page }) => {
    // Les widgets, le rappel du soir et les versions installées y mènent encore.
    const account = await createAccount("ancienne");
    await signIn(page, account, "/bibliotheque/lecture-du-jour");
    await expect(page).toHaveURL(/\/$/);
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
