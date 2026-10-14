import { ref } from "vue";
import { devicePreference } from "../services/devicePreference";

/**
 * L'accueil à son goût (P2-AccueilModifier) : l'ordre des blocs sous le
 * paquet du jour, qui reste toujours en tête, et ceux qu'on a masqués. On y
 * arrive par un appui long sur un bloc, ou par « Modifier l'accueil » en bas
 * de page. Un bloc qui n'a rien à dire s'efface de lui-même, rangé ou non.
 *
 * Un réglage de l'appareil, comme la taille du texte : l'accueil d'un
 * téléphone n'est pas celui d'un ordinateur.
 */
export type HomeBlock = "volumes" | "horaires" | "portes" | "reprendre" | "dates";

export const HOME_BLOCKS: readonly HomeBlock[] = [
  "horaires",
  "volumes",
  "portes",
  "reprendre",
  "dates",
];

export interface HomeLayout {
  order: HomeBlock[];
  hidden: HomeBlock[];
}

/** L'accueil d'origine, celui de P2-Accueil : Reprendre se propose, à remettre. */
export const DEFAULT_LAYOUT: HomeLayout = {
  order: ["horaires", "volumes", "portes", "dates"],
  hidden: ["reprendre"],
};

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
