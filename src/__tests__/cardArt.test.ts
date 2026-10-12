import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import ArtHanoukia from "../components/art/ArtHanoukia.vue";
import { CARD_ART_GEOMETRY } from "../components/CardArt.vue";

/**
 * L'objet d'une carte mise en avant (voir docs/design.md, « Une carte mise en
 * avant peut porter son objet ») : où il se pose, et ce qu'il dit du jour.
 */

let mounted: App[] = [];
afterEach(() => {
  for (const app of mounted) app.unmount();
  mounted = [];
  document.body.innerHTML = "";
});

async function render(props: { night: number; lit: boolean }): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(ArtHanoukia, props) });
  app.mount(host);
  mounted.push(app);
  await nextTick();
  return host;
}

describe("l'objet d'une carte mise en avant", () => {
  it("la lune dépasse du haut de la carte en calotte entière : le bord ne la coupe que plus bas", () => {
    const { rise, end } = CARD_ART_GEOMETRY.moon;
    const radius = 0.48; // le disque, dans un carré de côté 1
    const centerBelowTop = 0.5 - rise;
    const centerFromEdge = 0.5 + end;
    // Le haut du disque passe au-dessus de la carte...
    expect(0.5 - radius).toBeLessThan(rise);
    // ...et à la hauteur du bord haut, il tient dans la largeur de la carte.
    const halfWidthAtTop = Math.sqrt(radius ** 2 - centerBelowTop ** 2);
    expect(halfWidthAtTop).toBeLessThanOrEqual(centerFromEdge);
    // Plus bas, le bord de la carte la coupe.
    expect(centerFromEdge).toBeLessThan(radius);
  });

  it("aucun objet ne sort par le côté au-dessus de la carte, sauf la lune qui y est coupée", () => {
    for (const [kind, geometry] of Object.entries(CARD_ART_GEOMETRY)) {
      if (kind === "moon") continue;
      expect({ kind, inside: geometry.end >= 0 }).toEqual({ kind, inside: true });
    }
  });

  it("la 'hanoukkia porte les bougies du soir, et s'allume du chamach à la bougie de gauche", async () => {
    const host = await render({ night: 5, lit: true });
    const flames = [...host.querySelectorAll<SVGGElement>("g.flame")].map((flame) => ({
      order: Number(flame.style.getPropertyValue("--flame-order")),
      x: Number(/^M([\d.]+)/.exec(flame.querySelector("path")?.getAttribute("d") ?? "")?.[1]),
    }));
    // Le chamach et cinq bougies.
    expect(flames).toHaveLength(6);
    expect(flames[0]).toEqual({ order: 0, x: 50 });
    // Les bougies sont à droite, et la première allumée est la plus à gauche.
    const candles = flames.slice(1).sort((a, b) => a.order - b.order);
    expect(candles.map((candle) => candle.order)).toEqual([1, 2, 3, 4, 5]);
    expect(candles.map((candle) => candle.x)).toEqual([40, 60, 71, 82, 93]);
  });

  it("dans la journée, les bougies du soir sont posées, sans flamme", async () => {
    const host = await render({ night: 3, lit: false });
    expect(host.querySelectorAll("g.flame")).toHaveLength(0);
    expect(host.querySelectorAll("rect[fill]")).toHaveLength(3);
  });
});
