import {
  test,
  expect,
  createAccount,
  readDoc,
  seedDoc,
  signIn,
  tehilimId,
  uniqueId,
} from "../support/firebase";

/**
 * Le tirage sur la chaîne perpétuelle (docs/chaine-perpetuelle.md). Une place
 * réservée à la main y porte aussi une échéance (24 heures, posée par la
 * Cloud Function) : l'échéance seule ne distingue plus un tirage d'un choix,
 * et le lecteur rendait la place choisie en la quittant en mode tirage. Seul
 * ce que le lecteur a tiré se rend.
 */

const DAY = 24 * 3600 * 1000;

test("repartir d'un tirage ne rend pas une place réservée à la main", async ({ page }) => {
  const account = await createAccount("place");
  const manual = {
    id: "a-la-main",
    textStudyId: tehilimId(2),
    section: 1,
    chosenById: account.uid,
    chosenByName: account.name,
    isCompleted: false,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + DAY).toISOString(),
  };
  // Les Téhilim 3 à 150 lus par d'autres : seul le 1 est libre.
  const read = Array.from({ length: 148 }, (_, i) => ({
    id: `lu-${i + 3}`,
    textStudyId: tehilimId(i + 3),
    section: 1,
    chosenByGuestId: "autre-lecteur",
    chosenByName: "Un autre lecteur",
    isCompleted: true,
    createdAt: new Date(),
  }));
  const slug = `chaine-perpetuelle-${uniqueId()}`;
  await seedDoc("sessions", slug, {
    name: `Chaîne perpétuelle ${slug}`,
    type: "Tehilim",
    description: "Chaîne perpétuelle posée par la suite de bout en bout.",
    dateLimit: new Date("2100-01-01T00:00:00Z"),
    createdAt: new Date(),
    personId: "petite-jerusalem",
    creatorName: "Petite Jérusalem",
    slug,
    reservations: [manual, ...read],
    guestEmailRequired: false,
    perpetual: true,
    slotCount: 150,
    cycle: 1,
    completedCycles: 0,
    cycleStartedAt: new Date(),
  });
  await signIn(page, account, `/share-reading/session/${slug}`);

  await page.getByRole("button", { name: "Tirer un Téhilim" }).click();
  await expect(page).toHaveURL(new RegExp(`/lire/${tehilimId(1)}\\?`), { timeout: 20_000 });
  await expect
    .poll(async () => ((await readDoc("sessions", slug))?.reservations as unknown[]).length)
    .toBe(150);

  // Le suivant, c'est la place choisie à la main ; puis on repart sans lire.
  await page.getByRole("button", { name: "Tehilim 2 (ב)" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/lire/${tehilimId(2)}\\?`));
  await page.getByRole("button", { name: "Retour à la session" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Le tirage est rendu, la place choisie reste.
  await expect
    .poll(async () => {
      const all = (await readDoc("sessions", slug))?.reservations as {
        id: string;
        textStudyId: string;
      }[];
      return all
        .filter((r) => r.textStudyId === tehilimId(1) || r.id === "a-la-main")
        .map((r) => r.id);
    })
    .toEqual(["a-la-main"]);
});
