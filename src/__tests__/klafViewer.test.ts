import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The parchment: the command placed at the paragraph that carries it, and
 * the window it opens, the photo alone, edge to edge.
 *
 * What is at stake here does not show in a default render: the command
 * exists only on paragraphs marked `klaf`, the window is mounted only if the
 * page carries one, and it shows the photo with nothing but its cross (and,
 * for the two pages of the ketoret, the arrows that turn them).
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));

import fr from "../locales/fr";
import LiturgyText from "../views/TextReading/LiturgyText.vue";
import { parseTefilaBlocks } from "../services/textService";
import { closeKlaf, klafOpen } from "../composables/useKlaf";
import { KLAF_PHOTOS } from "../content/klaf";

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
    app.unmount();
  });

  it("ne monte pas la fenêtre devant un texte sans parchemin", () => {
    const { host, app } = monte(SANS_KLAF);
    expect(host.querySelector(".reading-klaf")).toBeNull();
    expect(document.body.querySelector(".klaf-panel")).toBeNull();
    app.unmount();
  });

  it("ouvre la photo seule, sans onglets ni légende, et la referme d'une croix", async () => {
    const { host, app } = monte(AVEC_KLAF);
    const [, menora] = host.querySelectorAll<HTMLButtonElement>(".reading-klaf");
    menora.click();
    await nextTick();
    expect(klafOpen.value).toBe("menora");
    const panneau = document.body.querySelector<HTMLElement>(".klaf-panel")!;
    expect(panneau.getAttribute("aria-label")).toBe(fr.textReading.klaf.menora.title);
    const photos = panneau.querySelectorAll("img");
    expect(photos).toHaveLength(1);
    expect(photos[0].getAttribute("src")).toBe("/klaf/menora.webp");
    // Nothing but the photo: no title, no tabs, no text.
    expect(panneau.querySelector("h3, [role='group'], p")).toBeNull();
    expect(panneau.textContent?.trim()).toBe("");
    // One page: no arrows.
    expect(panneau.querySelector(".klaf-pages")).toBeNull();

    panneau.querySelector<HTMLButtonElement>(".klaf-close")!.click();
    await nextTick();
    expect(klafOpen.value).toBeNull();
    app.unmount();
  });

  it("tourne les deux pages du pitoum haketoret", async () => {
    const { host, app } = monte(AVEC_KLAF);
    host.querySelector<HTMLButtonElement>(".reading-klaf")!.click();
    await nextTick();
    const panneau = document.body.querySelector<HTMLElement>(".klaf-panel")!;
    const src = () => panneau.querySelector("img")?.getAttribute("src");
    expect(src()).toBe("/klaf/ketoret-1.webp");
    expect(panneau.querySelector(".klaf-count")?.textContent?.trim()).toBe("1 / 2");

    const [precedente, suivante] = panneau.querySelectorAll<HTMLButtonElement>(".klaf-turn");
    expect(precedente.disabled).toBe(true);
    suivante.click();
    await nextTick();
    expect(src()).toBe("/klaf/ketoret-2.webp");
    expect(suivante.disabled).toBe(true);
    app.unmount();
  });
});

describe("les photos des parchemins", () => {
  // The window takes the photo's shape from the sizes written in
  // content/klaf.ts: a photo replaced without updating them would be cut.
  it("déclarent la taille réelle de leur fichier", () => {
    for (const photo of Object.values(KLAF_PHOTOS).flat()) {
      const size = webpSize(resolve("public", photo.src.slice(1)));
      expect({ src: photo.src, ...size }).toEqual({
        src: photo.src,
        width: photo.width,
        height: photo.height,
      });
    }
  });
});

/** The size of a WebP image, read from its header (VP8, VP8L or VP8X). */
function webpSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
}
