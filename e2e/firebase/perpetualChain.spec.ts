import type { Page } from "playwright/test";
import { HDate, months } from "@hebcal/core";
import {
  test,
  expect,
  createAccount,
  readDoc,
  seedDoc,
  seedPerpetualChain,
  seedTehilimSession,
  signIn,
  tehilimId,
  uniqueId,
} from "../support/firebase";
import { gotoApp } from "../support/fixtures";
import {
  PROJECT_ID,
  FIRESTORE_PORT,
  toFirestoreFields,
} from "../../scripts/lib/firebase-emulator.mjs";

/**
 * La chaîne perpétuelle de Tehilim (docs/chaine-perpetuelle.md) : sa carte en
 * tête du partage, les noms qu'on lui confie, et les règles Firestore qui les
 * gardent, et ce que la page et le lecteur font d'un tour fini. La remise à
 * zéro elle-même (Cloud Function) est tenue par
 * src/__tests__/perpetualChain.test.ts ; ici, le test la joue à sa place.
 */

const DAY = 24 * 3600 * 1000;
const DOCUMENTS = `projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * Un jeton non signé, que l'émulateur Firestore accepte comme celui d'un
 * compte connecté : de quoi éprouver les règles sans passer par l'interface.
 */
function fakeIdToken(uid: string): string {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", kid: "fakekid", typ: "JWT" })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    sub: uid,
    user_id: uid,
    firebase: { sign_in_provider: "password", identities: {} },
  })}.`;
}

type NameFields = Record<string, unknown>;

/**
 * Écrit un nom comme le ferait l'app (createdAt et updatedAt à l'heure du
 * serveur), au nom de `uid`, et rend le statut HTTP : 200 si les règles
 * l'acceptent, 403 sinon.
 */
async function writeName(uid: string, sessionId: string, fields: NameFields): Promise<number> {
  const toValue = (value: unknown): object => {
    if (value === null) return { nullValue: null };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (typeof value === "number") return { integerValue: String(value) };
    return { stringValue: String(value) };
  };
  const res = await fetch(`http://localhost:${FIRESTORE_PORT}/v1/${DOCUMENTS}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${fakeIdToken(uid)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `${DOCUMENTS}/sessions/${sessionId}/names/nom-${uniqueId()}`,
            fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])),
          },
          updateTransforms: [
            { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
            { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
          ],
          currentDocument: { exists: false },
        },
      ],
    }),
  });
  return res.status;
}

/**
 * Écrit une session au nom de `uid`, comme le ferait un client qui parlerait à
 * Firestore sans passer par l'app, et rend le statut HTTP : 200 si les règles
 * l'acceptent, 403 sinon. Avec `only`, l'écriture ne touche que ces champs
 * d'une session qui existe déjà.
 */
async function writeSession(
  uid: string,
  sessionId: string,
  fields: Record<string, unknown>,
  only?: string[],
): Promise<number> {
  const res = await fetch(`http://localhost:${FIRESTORE_PORT}/v1/${DOCUMENTS}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${fakeIdToken(uid)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `${DOCUMENTS}/sessions/${sessionId}`,
            fields: toFirestoreFields(fields),
          },
          ...(only ? { updateMask: { fieldPaths: only } } : {}),
          currentDocument: { exists: only !== undefined },
        },
      ],
    }),
  });
  return res.status;
}

/** Les Téhilim `from` à `to` du tour, lus par d'autres. */
function readSlots(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => ({
    id: `lu-${from + i}`,
    textStudyId: tehilimId(from + i),
    section: 1,
    chosenByGuestId: "autre-lecteur",
    chosenByName: "Un autre lecteur",
    isCompleted: true,
    createdAt: new Date(),
  }));
}

/**
 * Ce que fait la Cloud Function d'un tour fini (nextRound) : les
 * réservations vidées, le tour suivant. Les émulateurs ne la font pas
 * tourner ; le test la joue lui-même, quand il veut.
 */
async function startNextRound(chainId: string): Promise<void> {
  const mask = ["reservations", "cycle", "completedCycles"]
    .map((field) => `updateMask.fieldPaths=${field}`)
    .join("&");
  const res = await fetch(
    `http://localhost:${FIRESTORE_PORT}/v1/${DOCUMENTS}/sessions/${chainId}?${mask}`,
    {
      method: "PATCH",
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: toFirestoreFields({ reservations: [], cycle: 2, completedCycles: 1 }),
      }),
    },
  );
  if (!res.ok) throw new Error(`Tour suivant : ${res.status} ${await res.text()}`);
}

/**
 * Le retard d'une Cloud Function au démarrage à froid. C'est le scénario même
 * du test, pas une attente de confort : la page qui ne relisait la chaîne
 * qu'une fois, cinq secondes après la fin du tour, restait figée quand la
 * fonction arrivait plus tard.
 */
const coldStart = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Les précisions des signalements d'une session, dans l'ordre d'arrivée. */
async function reportsOf(sessionId: string): Promise<string[]> {
  const res = await fetch(`http://localhost:${FIRESTORE_PORT}/v1/${DOCUMENTS}:runQuery`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "reports" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "sessionId" },
            op: "EQUAL",
            value: { stringValue: sessionId },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Signalements : ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as {
    document?: { fields: Record<string, { stringValue?: string; timestampValue?: string }> };
  }[];
  return rows
    .flatMap((row) => (row.document ? [row.document.fields] : []))
    .sort((a, b) =>
      (a.createdAt?.timestampValue ?? "").localeCompare(b.createdAt?.timestampValue ?? ""),
    )
    .map((fields) => fields.details?.stringValue ?? "");
}

/**
 * Coupe ou rend le réseau de Firestore, sans que l'appareil le sache :
 * `navigator.onLine` reste vrai, comme sur un réseau qui ne répond plus. (Un
 * appareil qui se sait hors ligne voit « Connexion impossible » à la place de
 * la page, fenêtre comprise.)
 */
async function muteFirestore(page: Page, muted: boolean): Promise<void> {
  const firestore = new RegExp(`localhost:${FIRESTORE_PORT}`);
  if (muted) await page.route(firestore, (route) => route.abort("timedout"));
  else await page.unroute(firestore);
}

/** Les noms d'une chaîne, tels que Firestore les garde. */
async function namesOf(chainId: string): Promise<unknown[]> {
  const res = await fetch(
    `http://localhost:${FIRESTORE_PORT}/v1/${DOCUMENTS}/sessions/${chainId}/names`,
    { headers: { Authorization: "Bearer owner" } },
  );
  if (!res.ok) throw new Error(`Noms : ${res.status} ${await res.text()}`);
  return ((await res.json()) as { documents?: unknown[] }).documents ?? [];
}

/**
 * La date hébraïque d'un jour à venir, telle que la fenêtre la garde. Adar I
 * d'une année à treize mois ne se dit pas dans ce modèle (un décès d'Adar
 * revient en Adar II) : le test qui tomberait dessus ne prouverait rien.
 */
function hebrewDayIn(days: number): { day: number; month: number } | null {
  const date = new HDate(new Date(Date.now() + days * DAY));
  const month = date.getMonth();
  if (month === months.ADAR_I && HDate.isLeapYear(date.getFullYear())) return null;
  return { day: date.getDate(), month: month === months.ADAR_II ? months.ADAR_I : month };
}

test.describe("chaîne perpétuelle", () => {
  test("elle a sa carte en tête du partage, et sort de la liste des sessions", async ({ page }) => {
    const owner = await createAccount("proprio");
    const ordinary = await seedTehilimSession(owner);
    await seedPerpetualChain();
    await gotoApp(page, "/share-reading");
    const card = page.locator("[data-perpetual-card]");
    await expect(card).toBeVisible({ timeout: 20_000 });
    // La liste des sessions en cours garde les chaînes ordinaires, sans elle.
    const list = page.locator("[data-session-list]");
    await expect(list).toContainText(ordinary.name, { timeout: 20_000 });
    await expect(list).not.toContainText("Chaîne perpétuelle");
    await card.click();
    await expect(page).toHaveURL(/\/share-reading\/session\/chaine-perpetuelle-/);
  });

  test("un compte propose un nom, le retrouve à sa couleur, puis le retire", async ({ page }) => {
    const account = await createAccount("nom");
    const chain = await seedPerpetualChain();
    await signIn(page, account, `/share-reading/session/${chain.slug}`);

    const names = page.locator("[data-prayer-names]");
    await names.getByRole("button", { name: "Proposer un nom" }).click();
    const dialog = page.getByRole("dialog", { name: "Proposer un nom" });
    await dialog.getByRole("button", { name: "Une femme" }).click();
    await dialog.locator("#prayer-first-name").fill("Rivka");
    await dialog.locator("#prayer-mother-name").fill("Léa");
    await expect(dialog).toContainText("Rivka bat Léa");
    await dialog.getByRole("button", { name: "Ajouter le nom" }).click();

    // Le nom est à lui : une pastille qui s'ouvre, et qui tient au rechargement.
    const mine = names.getByRole("button", { name: "Modifier Rivka bat Léa" });
    await expect(mine).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(mine).toBeVisible({ timeout: 20_000 });

    await mine.click();
    await page
      .getByRole("dialog", { name: "Votre nom dans la liste" })
      .getByRole("button", {
        name: "Retirer",
      })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Retirer" }).click();
    await expect(mine).toHaveCount(0);
  });

  test("on y signale un nom après l'autre, sans bloquer son créateur", async ({ page }) => {
    const chain = await seedPerpetualChain();
    await gotoApp(page, `/share-reading/session/${chain.slug}`);

    for (const name of ["Premier Nom", "Second Nom"]) {
      const report = page.getByRole("button", { name: "Signaler", exact: true });
      await expect(report).toBeEnabled({ timeout: 20_000 });
      await report.click();
      const form = page.locator("form", { has: page.locator("#report-details") });
      await expect(form).toBeVisible();
      // Bloquer le créateur retirait toute la chaîne de l'appareil.
      await expect(page.getByText("Bloquer ce créateur")).toHaveCount(0);
      await form.locator("#report-details").fill(name);
      await form.getByRole("button", { name: "Signaler" }).click();
      await expect(page.getByText("Merci, votre signalement a bien été transmis.")).toBeVisible();
      await expect(form).toHaveCount(0);
    }

    await expect
      .poll(() => reportsOf(chain.id), { timeout: 10_000 })
      .toEqual(["Premier Nom", "Second Nom"]);
  });

  test("serveur muet : la fenêtre rend la main, et le nom n'arrive qu'une fois", async ({
    page,
  }) => {
    const account = await createAccount("reseau-muet");
    const chain = await seedPerpetualChain();
    await signIn(page, account, `/share-reading/session/${chain.slug}`);

    const names = page.locator("[data-prayer-names]");
    await names.getByRole("button", { name: "Proposer un nom" }).click();
    const dialog = page.getByRole("dialog", { name: "Proposer un nom" });
    await dialog.locator("#prayer-first-name").fill("Yossef");
    await dialog.locator("#prayer-mother-name").fill("Rahel");

    // L'appareil se croit en ligne, mais Firestore ne répond plus.
    await muteFirestore(page, true);
    const add = dialog.getByRole("button", { name: "Ajouter le nom" });
    await add.click();
    const pending = page.getByText(/Le serveur ne répond pas/).first();
    await expect(pending).toBeVisible({ timeout: 20_000 });
    // La fenêtre reste ouverte, avec ce qui a été saisi, et le bouton répond.
    await expect(dialog.locator("#prayer-first-name")).toHaveValue("Yossef");
    await expect(add).toBeEnabled();
    // On réessaie quand même : c'est le même ajout qui reste en route.
    await add.click();

    await muteFirestore(page, false);
    await expect(names.getByRole("button", { name: "Modifier Yossef ben Rahel" })).toBeVisible({
      timeout: 90_000,
    });
    await expect.poll(() => namesOf(chain.id), { timeout: 10_000 }).toHaveLength(1);
  });

  test("un défunt daté ne paraît que la semaine de son anniversaire", async ({ page }) => {
    const soon = hebrewDayIn(3);
    const later = hebrewDayIn(40);
    test.skip(!soon || !later, "Adar I d'une année embolismique : voir hebrewDayIn.");
    const chain = await seedPerpetualChain();
    const name = (firstName: string, date: { day: number; month: number }) => ({
      ownerId: "quelqu-un",
      gender: "male",
      firstName,
      motherName: "Messaouda",
      kind: "leilouy",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: null,
      deathDay: date.day,
      deathMonth: date.month,
    });
    await seedDoc(`sessions/${chain.id}/names`, `bientot-${uniqueId()}`, name("Yaakov", soon!));
    await seedDoc(
      `sessions/${chain.id}/names`,
      `plus-tard-${uniqueId()}`,
      name("Mordekhai", later!),
    );

    await gotoApp(page, `/share-reading/session/${chain.slug}`);
    const names = page.locator("[data-prayer-names]");
    await expect(names).toContainText("Yaakov ben Messaouda", { timeout: 20_000 });
    await expect(names).not.toContainText("Mordekhai");
  });

  test("les règles ne laissent écrire un nom qu'en son nom, et sur la chaîne perpétuelle", async () => {
    const chain = await seedPerpetualChain();
    const owner = await createAccount("proprio");
    const ordinary = await seedTehilimSession(owner);
    const uid = `compte-${uniqueId()}`;
    const valid = {
      ownerId: uid,
      gender: "male",
      firstName: "David",
      motherName: "Sarah",
      kind: "refoua",
      expiresAt: new Date(Date.now() + 30 * DAY),
    };

    expect(await writeName(uid, chain.id, valid)).toBe(200);
    // Au nom d'un autre compte.
    expect(await writeName(uid, chain.id, { ...valid, ownerId: "un-autre" })).toBe(403);
    // Sur une chaîne ordinaire.
    expect(await writeName(uid, ordinary.id, valid)).toBe(403);
    // Une échéance au-delà de trente et un jours.
    const tooLong = new Date(Date.now() + 60 * DAY);
    expect(await writeName(uid, chain.id, { ...valid, expiresAt: tooLong })).toBe(403);
    // Une date de décès sur une refoua chelema.
    const dated = { ...valid, expiresAt: null, deathDay: 12, deathMonth: 1 };
    expect(await writeName(uid, chain.id, dated)).toBe(403);
    // Le même, en leilouy nichmat : accepté, sans échéance.
    expect(await writeName(uid, chain.id, { ...dated, kind: "leilouy" })).toBe(200);
  });

  test("les règles réservent le drapeau et le compteur de la chaîne à l'admin", async () => {
    const uid = `compte-${uniqueId()}`;
    const session = {
      name: "Chaîne d'un compte",
      description: "Posée sans passer par l'app.",
      type: "Tehilim",
      dateLimit: new Date(Date.now() + 7 * DAY),
      createdAt: new Date(),
      personId: uid,
      creatorName: "Quelqu'un",
      slug: `chaine-d-un-compte-${uniqueId()}`,
      guestEmailRequired: false,
      reservations: [],
    };

    // Un compte ne se fait pas passer pour la chaîne perpétuelle : elle
    // prendrait sa carte en tête du partage, et la modération ne la masquerait
    // plus au troisième signalement.
    const forged = `session-${uniqueId()}`;
    expect(await writeSession(uid, forged, { ...session, perpetual: true })).toBe(403);
    expect(await writeSession(uid, forged, { ...session, slotCount: 1, cycle: 9 })).toBe(403);

    // La même, sans ces champs : c'est une session ordinaire, acceptée.
    const own = `session-${uniqueId()}`;
    expect(await writeSession(uid, own, session)).toBe(200);
    // Son créateur la modifie, mais n'en fait pas une chaîne perpétuelle après coup.
    expect(await writeSession(uid, own, { ...session, name: "Renommée" }, ["name"])).toBe(200);
    expect(await writeSession(uid, own, { ...session, perpetual: true }, ["perpetual"])).toBe(403);
    expect(
      await writeSession(uid, own, { ...session, completedCycles: 40 }, ["completedCycles"]),
    ).toBe(403);
    expect((await readDoc("sessions", own))?.perpetual).toBeUndefined();
  });
  test("un tour fini : la page relit la chaîne jusqu'au tour suivant", async ({ page }) => {
    const chain = await seedPerpetualChain({ reservations: readSlots(1, 150) });
    await gotoApp(page, `/share-reading/session/${chain.slug}`);
    await expect(page.getByText("Tour terminé !")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Tirer un Téhilim" })).toHaveCount(0);

    // La fonction arrive après le seul rechargement que faisait la page.
    await coldStart(7_000);
    await startNextRound(chain.id);

    await expect(page.getByRole("button", { name: "Tirer un Téhilim" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Tour terminé !")).toHaveCount(0);
  });

  test("un tour fini dans le lecteur : « Un autre Téhilim » attend le tour suivant", async ({
    page,
  }) => {
    // Un seul Téhilim libre : le tirage tombe sur lui, et sa lecture finit le tour.
    const chain = await seedPerpetualChain({ reservations: readSlots(1, 149) });
    await gotoApp(page, `/share-reading/session/${chain.slug}`);
    await page.getByRole("button", { name: "Tirer un Téhilim" }).click();
    await expect(page).toHaveURL(new RegExp(`/lire/${tehilimId(150)}\\?`), { timeout: 20_000 });

    // La carte de réservation est en tête et au pied du texte : la première suffit.
    const markRead = page.getByRole("button", { name: "Marquer comme lu" }).first();
    await expect(markRead).toBeVisible({ timeout: 20_000 });
    await markRead.click();
    await expect(page.getByRole("button", { name: "Remettre en non lu" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Un autre Téhilim" }).first().click();
    // La copie locale dit tout pris ; la chaîne relue dit le tour fini.
    await expect(page.getByText("Tour terminé !")).toBeVisible({ timeout: 10_000 });
    await coldStart(3_000);
    await startNextRound(chain.id);

    await expect(page).not.toHaveURL(new RegExp(`/lire/${tehilimId(150)}\\?`), {
      timeout: 30_000,
    });
    await expect(
      page.getByText("Tous les Téhilim de cette session sont déjà réservés."),
    ).toHaveCount(0);
    await expect
      .poll(async () => ((await readDoc("sessions", chain.id))?.reservations as unknown[]).length)
      .toBe(1);
  });
});
