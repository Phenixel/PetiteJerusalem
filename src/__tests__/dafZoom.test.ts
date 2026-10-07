import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import { dafZoomFrame } from "../services/dafZoom";
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

describe("la place que prend la page agrandie", () => {
  it("déborde de la colonne quand l'écran a de la place : un ordinateur", () => {
    // Une colonne de 650 px au milieu d'un écran de 2000 px, agrandie 1,6 fois.
    const frame = dafZoomFrame(1.6, 650, 659, 659);
    expect(frame.page).toBeCloseTo(1040);
    // La page tient entière : rien à faire glisser.
    expect(650 + 2 * frame.grow).toBeCloseTo(frame.page);
  });

  it("ne déborde pas plus que la place libre, et glisse pour le reste", () => {
    const frame = dafZoomFrame(1.6, 700, 40, 40);
    expect(frame.grow).toBe(40);
    expect(frame.page).toBeGreaterThan(700 + 2 * frame.grow);
  });

  it("s'arrête au côté le plus étroit : le volet des commentaires ouvert", () => {
    expect(dafZoomFrame(1.35, 600, 300, 20).grow).toBe(20);
    expect(dafZoomFrame(1.35, 600, 300, -10).grow).toBe(0);
  });

  it("ne déborde pas sur un téléphone, ni quand la page rétrécit", () => {
    expect(dafZoomFrame(1.6, 358, 0, 0)).toEqual({ page: 358 * 1.6, grow: 0 });
    expect(dafZoomFrame(0.85, 650, 600, 600).grow).toBe(0);
    expect(dafZoomFrame(1, 650, 600, 600).grow).toBe(0);
  });
});
