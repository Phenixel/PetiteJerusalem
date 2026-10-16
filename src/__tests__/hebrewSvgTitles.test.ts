import { describe, expect, it } from "vitest";
import { createApp, h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import LibraryShelf from "../components/LibraryShelf.vue";
import ProgramVolume from "../components/parcours/ProgramVolume.vue";

/**
 * Les titres des livres, écrits en SVG (l'étagère de la bibliothèque, les
 * volumes de Mon parcours). WebKit (Safari, l'app iPhone) pose chaque lettre
 * d'un texte SVG l'une après l'autre, de gauche à droite, dès qu'il porte un
 * interlettrage ou un `textLength` : l'hébreu s'y lisait à l'envers. Un
 * titre en hébreu n'en porte donc jamais ; un titre latin garde les siens.
 */

function render(component: unknown, props: Record<string, unknown>): HTMLElement {
  const host = document.createElement("div");
  const app = createApp({ render: () => h(component as never, props) });
  app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: {} }] }));
  app.mount(host);
  return host;
}

describe("titres hébreux en SVG", () => {
  it("l'étagère n'espace pas les lettres d'un titre hébreu", () => {
    const host = render(LibraryShelf, {
      books: [
        { corpus: "tehilim", to: "/", label: "תהילים" },
        { corpus: "talmud", to: "/", label: "Talmud" },
      ],
    });
    const titles = [...host.querySelectorAll("text.book-title")];
    expect(titles.map((t) => t.classList.contains("book-title-spaced"))).toEqual([false, true]);
  });

  it("un volume rapetisse un mot hébreu trop long au lieu de le resserrer", () => {
    const host = render(ProgramVolume, {
      color: "#7a3b2e",
      lines: ["והתעוררותםשלאחרונים"],
      progress: 0,
    });
    const title = host.querySelector("text.title")!;
    expect(title.hasAttribute("textLength")).toBe(false);
    expect(parseFloat((title as SVGElement).style.fontSize)).toBeLessThan(9);
  });

  it("un titre latin trop long, lui, se resserre", () => {
    const host = render(ProgramVolume, {
      color: "#7a3b2e",
      lines: ["Bereshitbarabereshitbara"],
      progress: 0,
    });
    expect(host.querySelector("text.title")!.hasAttribute("textLength")).toBe(true);
  });
});
