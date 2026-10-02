import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { HDate, months } from "@hebcal/core";

/**
 * Une date personnelle se saisit aussi par sa date civile, pour qui ne
 * connaît pas la date hébraïque. Ce test tient ce qui compte : c'est la date
 * HÉBRAÏQUE qui s'enregistre, calculée du jour civil choisi, et le coucher du
 * soleil la fait passer au lendemain.
 *
 * Il tient aussi le conseil posé sous la date d'un leilouy nichmat : poser la
 * date du décès, la première année seule se comptant de l'enterrement.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));

import fr from "../locales/fr";

const STORAGE_KEY = "pj_hebrew_occasions";

function stored(): { name: string; day: number; month: number; firstAdar?: boolean }[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as {
    name: string;
    day: number;
    month: number;
    firstAdar?: boolean;
  }[];
}

function button(root: ParentNode, text: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!found) throw new Error(`Bouton introuvable : ${text}`);
  return found as HTMLButtonElement;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) await nextTick();
}

async function ouvre() {
  const { default: OccasionsModal } = await import("../views/Zmanim/OccasionsModal.vue");
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () => h(OccasionsModal, { show: true, today: new HDate(1, months.TISHREI, 5787) }),
  });
  app.use(i18n);
  app.mount(host);
  await nextTick();
  return host;
}

/** Ouvre le formulaire, nomme la date, et passe à la saisie civile. */
async function formulaireCivil(host: HTMLElement): Promise<void> {
  button(host, "Ajouter une date").click();
  await settle();
  const name = host.querySelector<HTMLInputElement>("#occasion-name")!;
  name.value = "Sarah";
  name.dispatchEvent(new Event("input"));
  button(host, "Saisir la date civile").click();
  await settle();
}

/** Choisit un jour du mois affiché (AAAA-MM-JJ) dans le calendrier de la maison. */
async function choisit(host: HTMLElement, day: string): Promise<void> {
  host.querySelector<HTMLButtonElement>("#occasion-civil")!.click();
  await settle();
  const cell = document.querySelector<HTMLButtonElement>(`[data-day="${day}"]`);
  if (!cell) throw new Error("Jour introuvable dans le calendrier");
  cell.click();
  await settle();
  const picker = cell.closest<HTMLElement>('[role="dialog"]')!;
  button(picker, "Confirmer").click();
  await settle();
}

const choisitLe2Octobre = (host: HTMLElement) => choisit(host, "2026-10-02");

describe("saisir une date personnelle par sa date civile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 2, 12));
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("n'enregistre rien tant que le jour civil n'est pas choisi", async () => {
    const host = await ouvre();
    await formulaireCivil(host);

    expect(button(host, "Confirmer").disabled).toBe(true);
  });

  it("enregistre la date hébraïque du jour civil choisi", async () => {
    const host = await ouvre();
    await formulaireCivil(host);
    await choisitLe2Octobre(host);

    expect(host.textContent).toContain("Date hébraïque : 21 Tichri 5787");
    button(host, "Confirmer").click();
    await settle();

    expect(stored()).toMatchObject([{ name: "Sarah", day: 21, month: months.TISHREI }]);
    // Hors d'Adar I, rien de plus ne se garde.
    expect(stored()[0]).not.toHaveProperty("firstAdar");
  });

  it("garde Adar I d'une année à treize mois : la date y revient, pas en Adar II", async () => {
    // Le 22 février 2027 est le 15 Adar I 5787.
    vi.setSystemTime(new Date(2027, 1, 22, 12));
    const host = await ouvre();
    await formulaireCivil(host);
    await choisit(host, "2027-02-22");

    expect(host.textContent).toContain("Date hébraïque : 15 Adar I 5787");
    button(host, "Confirmer").click();
    await settle();

    expect(stored()).toMatchObject([
      { name: "Sarah", day: 15, month: months.ADAR_I, firstAdar: true },
    ]);
    // La liste la nomme comme elle a été trouvée, et la fait revenir le même jour.
    expect(host.textContent).toContain("15 Adar I");
    expect(host.textContent).toContain("lundi 22 février 2027");
    expect(host.textContent).not.toContain("Adar II");
  });

  it("montre Adar I dans la saisie hébraïque, où Adar ne figure sinon qu'une fois", async () => {
    vi.setSystemTime(new Date(2027, 1, 22, 12));
    const host = await ouvre();
    await formulaireCivil(host);
    await choisit(host, "2027-02-22");
    button(host, "Saisir la date hébraïque").click();
    await settle();

    // Le mois affiché est celui qu'on a trouvé : Adar I, et non Adar.
    expect(host.textContent).toContain("Adar I");
    button(host, "Saisir la date civile").click();
    await settle();
    button(host, "Confirmer").click();
    await settle();

    expect(stored()[0]).toMatchObject({ month: months.ADAR_I, firstAdar: true });
  });

  it("passe au lendemain hébraïque après le coucher du soleil", async () => {
    const host = await ouvre();
    await formulaireCivil(host);
    await choisitLe2Octobre(host);
    const sunset = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    sunset.click();
    await settle();

    button(host, "Confirmer").click();
    await settle();

    expect(stored()).toMatchObject([{ name: "Sarah", day: 22, month: months.TISHREI }]);
  });
});

describe("le conseil de la date d'un leilouy nichmat", () => {
  const CONSEIL = "Indiquez la date du décès";

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("dit de poser la date du décès, et l'exception de la première année", async () => {
    const host = await ouvre();
    button(host, "Ajouter une date").click();
    await settle();

    // Leilouy nichmat est le choix par défaut d'une date nouvelle.
    expect(host.textContent).toContain(CONSEIL);
    expect(host.textContent).toContain("la première année se compte du jour de l'enterrement");

    // Il suit la saisie civile.
    button(host, "Saisir la date civile").click();
    await settle();
    expect(host.textContent).toContain(CONSEIL);
  });

  it("ne paraît pas pour un anniversaire", async () => {
    const host = await ouvre();
    button(host, "Ajouter une date").click();
    await settle();
    button(host, "Anniversaire").click();
    await settle();

    expect(host.textContent).not.toContain(CONSEIL);
  });
});
