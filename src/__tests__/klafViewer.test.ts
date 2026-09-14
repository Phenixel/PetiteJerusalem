import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";

/**
 * Le parchemin : la commande posée au paragraphe qui le porte, la fenêtre
 * qu'elle ouvre, et la retranscription du psaume en menora.
 *
 * Ce qui se joue ici ne se voit pas dans un rendu par défaut : la commande
 * n'existe que sur les paragraphes marqués `klaf`, la fenêtre n'est montée
 * que si la page en porte un, et la menora doit avoir ses sept branches, la
 * cinquième (la tige) descendant seule jusqu'au pied.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));

import fr from "../locales/fr";
import LiturgyText from "../views/TextReading/LiturgyText.vue";
import { parseTefilaBlocks } from "../services/textService";
import { closeKlaf, klafOffered, klafOpen } from "../composables/useKlaf";
import { MENORA_KLAF } from "../content/klaf";

const AVEC_KLAF = parseTefilaBlocks([
  {
    lines: [
      { he: "אַתָּה הוּא יְהֹוָה אֱלֹהֵֽינוּ", klaf: "ketoret" },
      { he: "לַמְנַצֵּ֥חַ בִּנְגִינֹ֗ת", klaf: "menora" },
      // Un parchemin que ce lecteur ne connaît pas n'ouvre rien.
      { he: "בָּרוּךְ אַתָּה", klaf: "inconnu" },
      "שְׁמַע יִשְׂרָאֵל",
    ],
  },
]);

const SANS_KLAF = parseTefilaBlocks([{ lines: ["שְׁמַע יִשְׂרָאֵל"] }]);

function monte(blocks: ReturnType<typeof parseTefilaBlocks>) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(LiturgyText, {
        blocks,
        showPhonetic: false,
        occasions: new Set<string>(),
        recentChanges: new Set<string>(),
        highlightedLine: null,
        selectedLine: null,
        isBookmarked: () => false,
      }),
  });
  app.use(i18n);
  app.mount(host);
  return { host, app };
}

describe("le parchemin dans le fil du sidour", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    closeKlaf();
  });

  it("pose la commande sur les seuls paragraphes qui portent un parchemin connu", () => {
    const { host, app } = monte(AVEC_KLAF);
    const commandes = [...host.querySelectorAll<HTMLButtonElement>(".reading-klaf")];
    expect(commandes.map((b) => b.textContent?.trim())).toEqual([
      fr.textReading.klaf.ketoret.open,
      fr.textReading.klaf.menora.open,
    ]);
    // Le menu de lecture saura les proposer, dans l'ordre des parchemins.
    expect(klafOffered.value).toEqual(["ketoret", "menora"]);
    app.unmount();
    expect(klafOffered.value).toEqual([]);
  });

  it("ne monte pas la fenêtre devant un texte sans parchemin", () => {
    const { host, app } = monte(SANS_KLAF);
    expect(host.querySelector(".reading-klaf")).toBeNull();
    expect(document.body.querySelector(".klaf-panel")).toBeNull();
    app.unmount();
  });

  it("ouvre le parchemin demandé, photo d'abord, puis sa retranscription", async () => {
    const { host, app } = monte(AVEC_KLAF);
    const [, menora] = host.querySelectorAll<HTMLButtonElement>(".reading-klaf");
    menora.click();
    await nextTick();
    expect(klafOpen.value).toBe("menora");
    const panneau = document.body.querySelector<HTMLElement>(".klaf-panel")!;
    expect(panneau.textContent).toContain(fr.textReading.klaf.menora.title);
    expect(panneau.querySelectorAll("img")).toHaveLength(1);
    expect(panneau.querySelector("img")?.getAttribute("src")).toBe("/klaf/menora.webp");

    // L'onglet du texte : sept branches, la tige au milieu, le pied.
    const onglets = [...panneau.querySelectorAll<HTMLButtonElement>('[role="group"] button')];
    onglets.find((b) => b.textContent?.trim() === fr.textReading.klaf.text)!.click();
    await nextTick();
    const branches = [...panneau.querySelectorAll(".menora-branch")];
    expect(branches).toHaveLength(7);
    expect(branches.map((b) => b.textContent?.trim())).toEqual([...MENORA_KLAF.branches]);
    expect(branches[3].classList.contains("menora-stem")).toBe(true);
    expect(panneau.querySelector(".menora-base")?.textContent?.trim()).toBe(MENORA_KLAF.base);

    // Fermée, elle rend l'état partagé.
    panneau.querySelector<HTMLButtonElement>(".icon-btn")!.click();
    await nextTick();
    expect(klafOpen.value).toBeNull();
    app.unmount();
  });

  it("montre les deux pages du pitoum haketoret", async () => {
    const { host, app } = monte(AVEC_KLAF);
    host.querySelector<HTMLButtonElement>(".reading-klaf")!.click();
    await nextTick();
    const panneau = document.body.querySelector<HTMLElement>(".klaf-panel")!;
    expect(panneau.querySelectorAll("img")).toHaveLength(2);
    app.unmount();
  });
});
