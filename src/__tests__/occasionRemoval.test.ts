import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { HDate, months } from "@hebcal/core";

/**
 * Supprimer une date personnelle demande confirmation.
 *
 * Une date qu'on a pris la peine d'inscrire, un leilouy nichmat surtout, ne
 * doit pas partir sur un doigt qui glisse vers la corbeille : rien ne permet
 * de la retrouver. Ce test tient la question, et surtout ce qu'une réponse
 * négative doit produire, c'est-à-dire rien.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));
// Le suivi du compte n'a rien à faire ici : sans ce leurre, la liste tirerait
// Firebase au montage.
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));

import fr from "../locales/fr";

const STORAGE_KEY = "pj_hebrew_occasions";

const DATES = [
  { id: "a", name: "Papy Élie", kind: "yahrzeit", day: 12, month: months.KISLEV, reminder: "none" },
  { id: "b", name: "Sarah", kind: "birthday", day: 3, month: months.IYYAR, reminder: "none" },
];

/** Les dates que l'appareil garde en ce moment. */
function stored(): { id: string }[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as { id: string }[];
}

/**
 * Monte la fenêtre, dates déjà en place.
 *
 * Les modules se chargent ICI, après le stockage : la liste des dates vit au
 * niveau du module et se lit une fois pour toutes à son chargement. La
 * confirmation vient du même chargement, sinon le test répondrait à une autre
 * instance que celle qui pose la question.
 */
async function ouvre() {
  const { default: OccasionsModal } = await import("../views/Zmanim/OccasionsModal.vue");
  const { useConfirmHost } = await import("../composables/useConfirm");
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () => h(OccasionsModal, { show: true, today: new HDate(1, months.TISHREI, 5787) }),
  });
  app.use(i18n);
  app.mount(host);
  await nextTick();
  return { app, host, ...useConfirmHost() };
}

/** Le bouton corbeille d'une date, tel que son étiquette le nomme. */
function trash(host: HTMLElement, name: string): HTMLButtonElement {
  const button = [...host.querySelectorAll("button")].find(
    (candidate) => candidate.getAttribute("aria-label") === `Supprimer ${name}`,
  );
  if (!button) throw new Error(`Corbeille introuvable pour ${name}`);
  return button as HTMLButtonElement;
}

describe("supprimer une date personnelle", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATES));
    document.body.innerHTML = "";
  });

  it("pose la question avant d'effacer, en nommant la date", async () => {
    const { host, request } = await ouvre();

    trash(host, "Papy Élie").click();
    await nextTick();

    expect(request.value?.title).toBe("Supprimer \u00ab\u00a0Papy \u00c9lie\u00a0\u00bb\u202f?");
    // Destructrice : bouton rouge, et le clavier arrive sur « Annuler ».
    expect(request.value?.danger).toBe(true);
    // Rien n'est parti tant que rien n'est répondu.
    expect(stored()).toHaveLength(2);
  });

  it("ne touche à rien quand la réponse est non", async () => {
    const { host, answer } = await ouvre();

    trash(host, "Papy Élie").click();
    await nextTick();
    answer(false);
    await nextTick();

    expect(stored().map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("efface la date, et elle seule, quand la réponse est oui", async () => {
    const { host, answer } = await ouvre();

    trash(host, "Papy Élie").click();
    await nextTick();
    answer(true);
    await nextTick();
    await nextTick();

    expect(stored().map((entry) => entry.id)).toEqual(["b"]);
  });
});
