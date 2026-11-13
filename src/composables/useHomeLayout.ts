import { ref } from "vue";
import { devicePreference } from "../services/devicePreference";

/**
 * The home page to one's liking (P2-AccueilModifier): the order of the blocks
 * under the day's deck, which always stays first, and the ones hidden. They
 * are arranged in place, on the home page itself (useHomeArrange), opened by
 * a long press on a block or by « Modifier l'accueil » at the bottom of the
 * page. A block with nothing to say disappears on its own, placed or not.
 *
 * A device setting, like the text size: a phone's home page is not a
 * computer's.
 */
export type HomeBlock =
  | "volumes"
  | "horaires"
  | "portes"
  | "reprendre"
  | "dates"
  | "livres"
  | "ecoute";

export const HOME_BLOCKS: readonly HomeBlock[] = [
  "horaires",
  "volumes",
  "portes",
  "reprendre",
  "dates",
  "livres",
  "ecoute",
];

export interface HomeLayout {
  order: HomeBlock[];
  hidden: HomeBlock[];
}

/**
 * The original home page, P2-Accueil's: « Reprendre », the pinned books
 * (useHomePinned) and « Reprendre l'écoute » are offered, to be shown.
 */
export const DEFAULT_LAYOUT: HomeLayout = {
  order: ["horaires", "volumes", "portes", "dates"],
  hidden: ["reprendre", "livres", "ecoute"],
};

/** A tile's box on screen, in viewport pixels; `wide` when it spans the row. */
export interface TileBox {
  left: number;
  top: number;
  width: number;
  height: number;
  wide: boolean;
}

/**
 * Dragging a block on the home page: the place it takes, given the pointer.
 * It takes the place of the tile under the pointer once the pointer has
 * passed that tile's middle in the direction of travel (down or along the
 * row, mirrored in Hebrew); otherwise it stays at `from`. Past the middle,
 * the tile moves aside and the pointer lands back in the held block's own
 * place, so nothing flips back and forth. Held by
 * src/__tests__/homeLayout.test.ts.
 */
export function pickSlot(
  x: number,
  y: number,
  from: number,
  boxes: readonly TileBox[],
  rtl = false,
): number {
  for (const [index, box] of boxes.entries()) {
    if (index === from) continue;
    if (x < box.left || x > box.left + box.width || y < box.top || y > box.top + box.height)
      continue;
    const past = box.wide
      ? y - (box.top + box.height / 2)
      : (rtl ? -1 : 1) * (x - (box.left + box.width / 2));
    if (index > from && past > 0) return index;
    if (index < from && past < 0) return index;
  }
  return from;
}

const isBlock = (value: unknown): value is HomeBlock =>
  typeof value === "string" && (HOME_BLOCKS as readonly string[]).includes(value);

/**
 * Ce que l'appareil garde, remis d'aplomb : un bloc inconnu (d'une version
 * plus récente) se tait, un bloc nouveau prend sa place au bout de l'ordre.
 */
export function normalizeLayout(raw: Partial<HomeLayout> | null): HomeLayout {
  const order = (raw?.order ?? []).filter(isBlock);
  const hidden = (raw?.hidden ?? []).filter(isBlock).filter((b) => !order.includes(b));
  const known = new Set([...order, ...hidden]);
  for (const block of DEFAULT_LAYOUT.order) if (!known.has(block)) order.push(block);
  for (const block of DEFAULT_LAYOUT.hidden) if (!known.has(block)) hidden.push(block);
  return { order: [...new Set(order)], hidden: [...new Set(hidden)] };
}

const store = devicePreference<HomeLayout>(
  "pj_home_layout",
  (raw) => {
    if (!raw) return null;
    try {
      return normalizeLayout(JSON.parse(raw) as Partial<HomeLayout>);
    } catch {
      return null;
    }
  },
  (layout) => JSON.stringify(layout),
);

const layout = ref<HomeLayout>(store.read() ?? normalizeLayout(null));

export function useHomeLayout() {
  function save(next: HomeLayout): void {
    layout.value = normalizeLayout(next);
    store.write(layout.value);
  }
  return {
    layout,
    move(block: HomeBlock, to: number): void {
      const order = layout.value.order.filter((b) => b !== block);
      order.splice(Math.max(0, Math.min(order.length, to)), 0, block);
      save({ ...layout.value, order });
    },
    hide(block: HomeBlock): void {
      save({
        order: layout.value.order.filter((b) => b !== block),
        hidden: [...layout.value.hidden, block],
      });
    },
    show(block: HomeBlock): void {
      save({
        order: [...layout.value.order, block],
        hidden: layout.value.hidden.filter((b) => b !== block),
      });
    },
  };
}
