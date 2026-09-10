import { test as base, expect, type ConsoleMessage, type Page } from "playwright/test";

/**
 * Socle des tests de bout en bout.
 *
 * Deux choses que tout test veut sans avoir à le dire :
 *
 *  1. Un appareil « propre » mais qui a déjà répondu à la bannière de
 *     consentement (refus par défaut : rien ne part vers PostHog) et vu
 *     l'introduction, pour que ni l'une ni l'autre ne recouvre la page
 *     testée. L'option `consent: "ask"` remet la bannière, pour la tester.
 *
 *  2. Un filet sur les erreurs JavaScript : une exception non rattrapée ou un
 *     `console.error` pendant le test le fait échouer, même si l'écran a l'air
 *     bon. C'est ainsi que la suite attrape les bugs qui ne cassent rien de
 *     visible (promesse rejetée, erreur Vue dans un watcher).
 */

type ConsentChoice = "granted" | "denied" | "ask";

type Options = {
  /** Réponse déjà donnée à la bannière de consentement (« ask » : aucune). */
  consent: ConsentChoice;
};

type Fixtures = {
  /** Erreurs JS relevées pendant le test ; vide à la fin, sinon échec. */
  pageErrors: string[];
};

// Bruit connu, qui n'est pas un bug de l'app :
//  - le SDK Auth, en mode DEV, cherche l'émulateur ; sans lui (projet
//    `public` lancé seul), la requête échoue et le navigateur le journalise ;
//  - Vite/Chromium signalent les ressources réseau injoignables de la même
//    façon (favicon d'un canal de preview, image d'un chiour de démo…).
const IGNORED_CONSOLE = [
  /ERR_CONNECTION_REFUSED/,
  /Failed to load resource/,
  /net::ERR_/,
  /\[vite\]/,
];

// Nommer un port d'émulateur ne suffit pas à faire taire un message : il faut
// qu'il porte aussi la marque d'un échec réseau. Dans le projet `firebase`,
// où les émulateurs répondent, une erreur du SDK (règles refusées, document
// absent) est journalisée avec son hôte : la filtrer sur le seul port la
// rendrait invisible, et c'est justement ce qu'on veut voir échouer.
const EMULATOR_HOST = /localhost:847\d/;
const NETWORK_FAILURE = /ERR_|Failed to fetch|NetworkError|network-request-failed/;

function watchErrors(page: Page, sink: string[]): void {
  page.on("pageerror", (error) => sink.push(`pageerror: ${error.message}`));
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    if (EMULATOR_HOST.test(text) && NETWORK_FAILURE.test(text)) return;
    sink.push(`console.error: ${text}`);
  });
}

export const test = base.extend<Options & Fixtures>({
  consent: ["denied", { option: true }],

  context: async ({ context, consent }, use) => {
    await context.addInitScript(
      ({ consent }: { consent: ConsentChoice }) => {
        try {
          if (consent !== "ask") localStorage.setItem("pj_analytics_consent", consent);
          localStorage.setItem("pj_onboarding_seen", "1");
        } catch {
          // Stockage indisponible : la bannière s'affichera, les tests qui la
          // supposent absente le diront.
        }
      },
      { consent },
    );
    await use(context);
  },

  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      watchErrors(page, errors);
      await use(errors);
      expect.soft(errors, "aucune erreur JavaScript pendant le test").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Ouvre une page de l'app et attend que Vue l'ait rendue (le shell est vide
 * tant que le bundle n'est pas arrivé : `#app` n'a pas d'enfant).
 */
export async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.locator("#app > *").first().waitFor();
}

/**
 * Choisit une ligne dans une liste déroulante de la maison (AppSelect).
 *
 * Ce n'est plus un `<select>` du système : `selectOption` n'a pas de prise
 * dessus, on ouvre le panneau et on touche la ligne, comme un lecteur.
 */
export async function chooseOption(page: Page, id: string, label: string): Promise<void> {
  await page.locator(`#${id}`).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

/**
 * Choisit un jour dans un champ de date de la maison (AppDateField), à partir
 * de sa valeur `YYYY-MM-DD`.
 *
 * Le calendrier montre six semaines, débordements des mois voisins compris :
 * le lendemain y est toujours, même le dernier jour du mois. Les cases
 * portent la date en toutes lettres, c'est par là qu'on la vise.
 */
export async function pickDate(page: Page, id: string, day: string): Promise<void> {
  const [year, month, date] = day.split("-").map(Number);
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, date));
  await page.locator(`#${id}`).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: label, exact: true }).click();
  await picker.getByRole("button", { name: "Confirmer", exact: true }).click();
}
