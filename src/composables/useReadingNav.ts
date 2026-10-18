import { computed, ref, shallowRef } from "vue";
import { useScrollFrame } from "./useScrollFrame";

/**
 * Le menu de lecture (ReadingMenu) : un bouton flottant d'où surgit un petit
 * panneau, le même sur tous les textes de la bibliothèque. Il porte toujours
 * le réglage de taille et le retour en haut de page ; les textes qui se
 * divisent (sections d'un office, montées d'une paracha, dafim d'une guemara)
 * y ajoutent leurs repères, passés au menu par la page de lecture.
 *
 * État partagé à l'échelle de l'app : le bouton global de remontée
 * (ScrollToTop, App.vue) s'efface tant qu'un menu de lecture est à l'écran,
 * le panneau faisant déjà ce travail.
 */
export interface ReadingNavSection {
  /**
   * Le repère du bloc dans le rendu (`data-block-anchor`), unique dans la
   * page : l'offset ne l'est pas en tefila, où un marqueur sans ligne partage
   * le sien avec le bloc suivant (voir TextBlock.anchor).
   */
  anchor: string;
  /** Offset du bloc dans la section (rang du saut, pour la mesure d'audience). */
  offset: number;
  /** Titre du bloc dans la langue du lecteur. */
  label: string;
  /**
   * Titre hébreu du bloc, quand il en a un et qu'il n'est pas déjà le `label`
   * (lecteur en hébreu). Le menu le donne à côté du titre traduit : c'est sous
   * ce nom-là qu'un passage se cherche, et qu'il est écrit dans le sidour de
   * papier posé à côté.
   */
  hebrew?: string;
}

// Menus montés : un compteur plutôt qu'un drapeau, le temps qu'une page de
// lecture remplace l'autre (le menu de la suivante se monte avant que celui de
// la précédente ne se démonte).
const mounted = ref(0);

export function addReadingMenu(): void {
  mounted.value += 1;
}

export function removeReadingMenu(): void {
  mounted.value = Math.max(0, mounted.value - 1);
}

/** Un menu de lecture est à l'écran : il tient lieu de bouton de remontée. */
export const readingNavActive = computed(() => mounted.value > 0);

/** La hauteur de l'en-tête : le titre d'un bloc vient se poser juste dessous. */
const HEADER_OFFSET = 84;

/**
 * Descend jusqu'au bloc qui porte ce repère (`data-block-anchor`), son titre
 * posé sous l'en-tête. Le menu de lecture s'en sert, et la page qui s'ouvre
 * sur un renvoi (#repère, voir TextLink). Faux si le bloc n'est pas à l'écran.
 */
export function scrollToBlockAnchor(anchor: string, behavior: ScrollBehavior = "auto"): boolean {
  const el = document.querySelector(`[data-block-anchor="${CSS.escape(anchor)}"]`);
  if (!(el instanceof HTMLElement)) return false;
  window.scrollTo({
    top: window.scrollY + el.getBoundingClientRect().top - HEADER_OFFSET,
    behavior,
  });
  return true;
}

/**
 * The landmarks of the reading menu, published for the progress bar: while
 * it is dragged, it shows the titles it passes (see ReadingProgressBar). The
 * menu sets them, and clears them when it leaves the page.
 */
export const readingSections = shallowRef<readonly ReadingNavSection[]>([]);

/**
 * The progress bar is being dragged: the round buttons of the menu step
 * aside, the titles of the bar taking their place above it.
 */
export const readingScrubbing = ref(false);

/**
 * The line of the screen that says where one is: just under the header, where
 * `scrollToBlockAnchor` lays a block's title. A section is the current one
 * once its title has reached it.
 */
export const READING_LINE = HEADER_OFFSET + 1;

/**
 * The position of each landmark in the document (its top, in pixels from the
 * top of the page), in the order of the sections. A landmark whose block is
 * not rendered is skipped: the result can be shorter than the list.
 */
export function measureSectionTops(
  sections: readonly ReadingNavSection[],
): { index: number; top: number }[] {
  if (typeof document === "undefined" || !sections.length) return [];
  // One query for the whole page rather than one per landmark: a guemara
  // publishes a landmark per daf.
  const byAnchor = new Map<string, HTMLElement>();
  for (const el of document.querySelectorAll<HTMLElement>("[data-block-anchor]")) {
    const anchor = el.dataset.blockAnchor;
    if (anchor && !byAnchor.has(anchor)) byAnchor.set(anchor, el);
  }
  const out: { index: number; top: number }[] = [];
  sections.forEach((section, index) => {
    const el = byAnchor.get(section.anchor);
    if (el) out.push({ index, top: window.scrollY + el.getBoundingClientRect().top });
  });
  return out;
}

/**
 * Where the reading line stands among the landmarks, as a fractional rank: 2
 * on the title of the third one, 2.5 halfway to the fourth. Before the first
 * title, the rank goes from -1 (top of the page) to 0; past the last one, it
 * stays on it. `tops` are increasing; -1 when there are none.
 */
export function sectionPosition(tops: readonly number[], line: number): number {
  if (!tops.length) return -1;
  if (line < tops[0]) return tops[0] > 0 ? Math.max(0, line) / tops[0] - 1 : 0;
  for (let i = 0; i < tops.length - 1; i++) {
    if (line < tops[i + 1]) {
      const span = tops[i + 1] - tops[i];
      return span > 0 ? i + (line - tops[i]) / span : i;
    }
  }
  return tops.length - 1;
}

/**
 * Where the reader stands among the landmarks, followed frame by frame: the
 * landmarks found in the page (`items`), the fractional rank of the reading
 * line among them (`position`, see `sectionPosition`), and the section being
 * read (`current`, null above the first title). The tops are measured again
 * only when the document changes height (a text arriving, a font size) or on
 * `remeasure()`, never at each scroll frame.
 */
export function useSectionPosition(sections: () => readonly ReadingNavSection[]) {
  const frame = useScrollFrame();
  const docHeight = computed(() => frame.value.docHeight);
  const tick = ref(0);
  const measured = computed(() => {
    void docHeight.value;
    void tick.value;
    return measureSectionTops(sections());
  });
  const items = computed(() => {
    const list = sections();
    return measured.value.map((m) => list[m.index]);
  });
  const position = computed(() =>
    sectionPosition(
      measured.value.map((m) => m.top),
      frame.value.scrollY + READING_LINE,
    ),
  );
  const current = computed<ReadingNavSection | null>(() => {
    const rank = Math.floor(position.value + 1e-6);
    return rank >= 0 ? (items.value[rank] ?? null) : null;
  });
  return {
    items,
    position,
    current,
    remeasure: () => {
      tick.value += 1;
    },
  };
}
