import { readonly, ref } from "vue";
import { devicePreference } from "../services/devicePreference";

/**
 * Deux réglages de la forme du Sefer Torah (TorahScroll.vue), pour qui
 * prépare une lecture :
 *
 *  - « Voyelles et teamim » : les afficher sur la colonne du parchemin, sans
 *    en changer les lignes (scrollPointing.ts). Éteint au départ : la forme
 *    est celle du Sefer Torah, qui n'en porte pas.
 *  - « Appui long » : tant qu'on reste appuyé sur le texte, il passe à
 *    l'autre forme (avec les signes si on lit sans, sans si on lit avec), et
 *    revient quand on relâche. C'est le geste de qui vérifie un mot puis
 *    reprend sa lecture. Éteint au départ : l'appui long sert d'ordinaire à
 *    choisir un passage.
 *
 * Gardés sur l'appareil, deux fois plutôt qu'une (voir devicePreference).
 */
const parse = (value: string | null): boolean | null =>
  value === "1" ? true : value === "0" ? false : null;
const write = (value: boolean): string => (value ? "1" : "0");

function preference(key: string) {
  const store = devicePreference(key, parse, write);
  const stored = store.read();
  const value = ref(stored ?? false);
  let restored = stored !== null;
  /** Reprend le choix gardé par le natif quand le localStorage n'a rien. */
  async function restore(): Promise<void> {
    if (restored) return;
    restored = true;
    const saved = await store.restore();
    if (saved !== null) value.value = saved;
  }
  function set(on: boolean): void {
    restored = true;
    if (value.value === on) return;
    value.value = on;
    store.write(on);
  }
  return { value, restore, set };
}

const pointed = preference("pj-scroll-pointed");
const peek = preference("pj-scroll-peek");

/** Les voyelles et les teamim sont-ils affichés sur le parchemin ? */
export const scrollPointed = readonly(pointed.value);
export const setScrollPointed = pointed.set;
/** L'appui long fait-il passer d'une forme à l'autre ? */
export const scrollPeek = readonly(peek.value);
export const setScrollPeek = peek.set;

/** À appeler par les vues qui portent ces réglages, avant de les afficher. */
export function restoreScrollPointing(): void {
  void pointed.restore();
  void peek.restore();
}
