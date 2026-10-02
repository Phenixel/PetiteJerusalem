import {
  test,
  expect,
  createAccount,
  readDoc,
  seedTehilimSession,
  signIn,
  tehilimId,
  uniqueId,
} from "../support/firebase";
import { chooseOption, gotoApp, pickDate } from "../support/fixtures";

type Reservation = {
  id: string;
  textStudyId: string;
  chosenById?: string;
  chosenByGuestId?: string;
  chosenByName?: string;
  isCompleted: boolean;
};

async function reservationsOf(sessionId: string): Promise<Reservation[]> {
  const doc = (await readDoc("sessions", sessionId)) as { reservations?: Reservation[] } | null;
  return doc?.reservations ?? [];
}

test.describe("chaînes de lecture", () => {
  test("une chaîne se crée depuis le formulaire", async ({ page }) => {
    const account = await createAccount("createur");
    await signIn(page, account, "/share-reading/new-session");
    const title = `Chaîne créée ${uniqueId()}`;
    await page.locator("#name").fill(title);
    await page.locator("#description").fill("Créée par la suite de bout en bout.");
    await chooseOption(page, "type", "Tehilim");
    // Les cinq sefarim sont cochés par défaut : on ne garde que le premier.
    await page.getByLabel("Tout sélectionner").uncheck();
    await page.getByLabel("Sefer 1", { exact: true }).check();
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    await pickDate(page, "dateLimit", tomorrow);
    await page.getByRole("button", { name: "Créer la session" }).click();

    // Une date limite si proche se confirme (docs/design.md, « Une chaîne
    // courte se confirme »).
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation).toContainText("Attention, votre date semble proche d'aujourd'hui");
    await confirmation.getByRole("button", { name: "Oui, créer la session" }).click();

    await expect(page).toHaveURL(/\/share-reading\/session\//, { timeout: 20_000 });
    // La chaîne créée s'ouvre sur la fenêtre de partage, qui dit pourquoi.
    await expect(page.getByText("Votre session est prête")).toBeVisible();
    await expect(page.getByText("Pensez à partager la session autour de vous")).toBeVisible();
    await expect(page).not.toHaveURL(/partager=/);
    await page.locator(".modal-panel").getByRole("button", { name: "Fermer" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    await expect(page.getByText("Tehilim 1", { exact: false }).first()).toBeVisible();
  });

  test("la page du partage liste une chaîne en cours", async ({ page }) => {
    const owner = await createAccount("proprio");
    const session = await seedTehilimSession(owner);
    await gotoApp(page, "/share-reading");
    await expect(page.getByText(session.name).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText(session.name).first().click();
    await expect(page).toHaveURL(new RegExp(`/share-reading/session/${session.slug}$`));
  });

  test("revenir à la chaîne juste après un tirage ne montre pas le texte comme pris", async ({
    page,
  }) => {
    // En production, la page de la chaîne lisait la session entre la pose du
    // tirage et son retrait au départ du lecteur : le texte paraissait réservé,
    // et le cocher répondait « Réservation introuvable ». Les écritures sont
    // ralenties ici pour que la course se joue à chaque fois.
    const owner = await createAccount("proprio");
    const session = await seedTehilimSession(owner);
    await page.route("**/documents:commit*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });

    await gotoApp(page, `/share-reading/session/${session.slug}`);
    await page.getByRole("button", { name: "Tirer un Téhilim" }).click();
    await expect(page).toHaveURL(/\/lire\//, { timeout: 20_000 });
    await expect.poll(async () => (await reservationsOf(session.id)).length).toBe(1);

    await page.getByRole("button", { name: "Retour à la session" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(session.name);
    await expect.poll(async () => (await reservationsOf(session.id)).length).toBe(0);
    await expect(page.getByRole("checkbox", { name: "Terminé" })).toHaveCount(0);
  });

  test("un compte réserve un psaume, le marque lu, puis annule", async ({ page }) => {
    const owner = await createAccount("proprio");
    const reader = await createAccount("lecteur");
    const session = await seedTehilimSession(owner);
    await signIn(page, reader, `/share-reading/session/${session.slug}`);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(session.name);
    await page.getByLabel("Réserver").first().check();
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText(/Réservation(s)? confirmée/)).toBeVisible();

    await expect.poll(async () => (await reservationsOf(session.id)).length).toBe(1);
    const [reservation] = await reservationsOf(session.id);
    expect(reservation.chosenById).toBe(reader.uid);
    expect(reservation.textStudyId).toBe(tehilimId(1));
    expect(reservation.isCompleted).toBe(false);

    // Marquer lu : l'interrupteur « Terminé » de la réservation.
    // La case est masquée visuellement (interrupteur) : on clique son étiquette.
    await page
      .locator("label", { has: page.getByRole("checkbox", { name: "Terminé" }) })
      .first()
      .click();
    await expect.poll(async () => (await reservationsOf(session.id))[0]?.isCompleted).toBe(true);

    // Annuler : décocher sa propre réservation puis confirmer.
    await page
      .getByRole("checkbox", { name: /Réservé|Sélectionné|Réserver/ })
      .first()
      .uncheck();
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect.poll(async () => (await reservationsOf(session.id)).length).toBe(0);
  });

  test("un invité réserve en donnant seulement son nom", async ({ page }) => {
    const owner = await createAccount("proprio");
    const session = await seedTehilimSession(owner);
    await gotoApp(page, `/share-reading/session/${session.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(session.name);

    await page.getByLabel("Réserver").first().check();
    await page.getByRole("button", { name: "Confirmer" }).click();

    const modal = page.getByRole("dialog").or(page.locator(".modal-overlay")).first();
    await expect(modal.getByText("Merci ! Dernière étape")).toBeVisible();
    await modal.locator('input[type="text"]').first().fill("Invité de passage");
    await modal.getByRole("button", { name: "Valider ma réservation" }).click();

    await expect.poll(async () => (await reservationsOf(session.id)).length).toBe(1);
    const [reservation] = await reservationsOf(session.id);
    expect(reservation.chosenByGuestId).toBeTruthy();
    expect(reservation.chosenByName).toBe("Invité de passage");
    await expect(page.getByText("Réservé par Invité de passage").first()).toBeVisible();
  });

  test("la chaîne exige l'email de l'invité quand elle le demande", async ({ page }) => {
    const owner = await createAccount("proprio");
    const session = await seedTehilimSession(owner, { guestEmailRequired: true });
    await gotoApp(page, `/share-reading/session/${session.slug}`);
    await page.getByLabel("Réserver").first().check();
    await page.getByRole("button", { name: "Confirmer" }).click();
    const modal = page.getByRole("dialog").or(page.locator(".modal-overlay")).first();
    await modal.locator('input[type="text"]').first().fill("Sans email");
    await modal.getByRole("button", { name: "Valider ma réservation" }).click();
    await expect(modal.getByText("Merci d'indiquer votre email.")).toBeVisible();
    expect((await reservationsOf(session.id)).length).toBe(0);
  });

  test("le créateur gère sa chaîne et la termine", async ({ page }) => {
    const owner = await createAccount("proprio");
    const session = await seedTehilimSession(owner);
    await signIn(page, owner, `/session-management/${session.id}`);
    await expect(page.getByText("Réservations").first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Terminer la session" }).click();
    await page.getByRole("button", { name: "Confirmer" }).last().click();
    await expect
      .poll(async () => ((await readDoc("sessions", session.id)) as { isEnded?: boolean })?.isEnded)
      .toBe(true);
  });

  test("une chaîne inconnue ne casse pas la page", async ({ page }) => {
    await gotoApp(page, "/share-reading/session/nexiste-pas");
    await expect(page.locator("#app")).not.toBeEmpty();
    await expect(page.getByRole("link", { name: /Partage de lectures/ }).first()).toBeVisible();
  });
});
