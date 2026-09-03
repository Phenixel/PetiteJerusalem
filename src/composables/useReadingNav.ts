import { computed, ref } from "vue";

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
  /** Offset du bloc dans la section : l'ancre `data-block-anchor` du rendu. */
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
