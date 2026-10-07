import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import type { DafBlock } from "../services/textService";

/**
 * Dans la forme de la page, la taille de lecture est une loupe : elle élargit
 * la page entière (TalmudDafPages) au lieu d'agrandir son texte, pour que les
 * lignes de la page de Vilna ne bougent pas.
 */

// La page elle-même se compose à l'écran : ici on ne regarde que ce que son
// cadre lui donne.
vi.mock("../components/TalmudPage.vue", () => ({
  default: defineComponent({
    props: { scale: { type: Number, required: true } },
    setup(props) {
      return () => h("div", { class: "page-stub", "data-scale": String(props.scale) });
    },
  }),
}));

const { default: TalmudDafPages } = await import("../components/TalmudDafPages.vue");

const blocks = [
  { daf: "2a", amud: 0, lines: ["מאימתי"], passages: [0] },
  { daf: "2b", amud: 1, lines: ["דילמא"], passages: [0] },
] as unknown as DafBlock[];

function mountPages(scale = ref(1)) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(TalmudDafPages, { blocks, meforshim: null, state: "ready", scale: scale.value }),
  });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.mount(host);
  return { host, scale };
}

describe("la loupe de la page du daf", () => {
  it("ne transmet jamais la taille de lecture au texte de la page", async () => {
    const { host, scale } = mountPages(ref(1.35));
    const scales = () =>
      [...host.querySelectorAll(".page-stub")].map((el) => el.getAttribute("data-scale"));
    expect(scales()).toEqual(["1", "1"]);
    scale.value = 1.6;
    await nextTick();
    expect(scales()).toEqual(["1", "1"]);
  });

  it("élargit la page entière à la taille de lecture", async () => {
    const { host, scale } = mountPages(ref(1));
    const widths = () =>
      [...host.querySelectorAll<HTMLElement>(".daf-zoom-page")].map((el) => el.style.width);
    expect(widths()).toEqual(["100%", "100%"]);
    scale.value = 1.6;
    await nextTick();
    expect(widths()).toEqual(["160%", "160%"]);
    scale.value = 0.85;
    await nextTick();
    expect(widths()).toEqual(["85%", "85%"]);
  });

  it("pose chaque page dans un cadre qui se fait glisser de côté", () => {
    const { host } = mountPages();
    const frames = host.querySelectorAll(".daf-zoom");
    expect(frames).toHaveLength(blocks.length);
    for (const frame of frames)
      expect(frame.querySelector(".daf-zoom-page .page-stub")).not.toBeNull();
  });
});
