import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));

import fr from "../locales/fr";
import LiturgyText from "../views/TextReading/LiturgyText.vue";
import { parseTefilaBlocks } from "../services/textService";
import { halakhotHidden, setHalakhotHidden } from "../composables/useHalakhot";

/**
 * « Masquer les halakhot » : les consignes de loi qui accompagnent un passage
 * (« en cas d'oubli, on reprend… ») quittent le fil du texte. Elles sont là
 * pour qui doute et encombrent qui sait : un office se dit tous les jours.
 *
 * Ce qui est vérifié ici : le texte, lui, reste entier ; seule la consigne
 * s'en va, et le réglage tient d'un lancement à l'autre.
 */
const BLOCS = parseTefilaBlocks([
  {
    labelText: { fr: "Amida", en: "Amidah", he: "עמידה" },
    halakha: { fr: "En cas d'oubli, on reprend", en: "If forgotten, repeat", he: "שכח, חוזר" },
    lines: [{ he: "אֲדֹנָי שְׂפָתַי תִּפְתָּח" }],
  },
]);

function monter() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(LiturgyText, {
        blocks: BLOCS,
        showPhonetic: false,
        occasions: new Set<string>(),
        recentChanges: new Set<string>(),
      }),
  });
  app.use(i18n);
  app.mount(host);
  return { host, fermer: () => (app.unmount(), host.remove()) };
}

describe("masquer les halakhot", () => {
  beforeEach(() => {
    localStorage.clear();
    setHalakhotHidden(false);
    document.body.innerHTML = "";
  });

  it("laisse les halakhot au texte tant que personne ne les a masquées", () => {
    expect(halakhotHidden.value).toBe(false);
    const { host, fermer } = monter();
    expect(host.querySelectorAll(".reading-halakha")).toHaveLength(1);
    expect(host.textContent).toContain("En cas d'oubli, on reprend");
    fermer();
  });

  it("les retire du fil, sans toucher au texte qui se dit", async () => {
    const { host, fermer } = monter();
    setHalakhotHidden(true);
    await nextTick();

    expect(host.querySelector(".reading-halakha")).toBeNull();
    expect(host.textContent).not.toContain("En cas d'oubli, on reprend");
    // Le texte hébreu et le titre du passage sont intacts : c'est la consigne
    // qui s'en va, pas la prière.
    expect(host.textContent).toContain("אֲדֹנָי שְׂפָתַי תִּפְתָּח");
    expect(host.textContent).toContain("Amida");

    setHalakhotHidden(false);
    await nextTick();
    expect(host.querySelectorAll(".reading-halakha")).toHaveLength(1);
    fermer();
  });

  it("tient d'un lancement à l'autre, à la différence de « sans tahanoun »", async () => {
    setHalakhotHidden(true);

    vi.resetModules();
    const module = await import("../composables/useHalakhot");
    expect(module.halakhotHidden.value).toBe(true);

    module.setHalakhotHidden(false);
    vi.resetModules();
    expect((await import("../composables/useHalakhot")).halakhotHidden.value).toBe(false);
  });
});
