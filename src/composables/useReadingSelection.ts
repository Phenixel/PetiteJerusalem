import { computed, shallowRef } from "vue";

/**
 * Le passage choisi dans un texte, et ce qu'on en fait.
 *
 * Sur un texte, le menu du système (copier, rechercher, partager, traduire)
 * n'est ni le nôtre ni celui de personne : il propose la traduction
 * automatique d'un verset et la recherche web d'un mot d'hébreu, et il
 * s'ouvre par-dessus tout ce qu'on poserait à côté. Les passages des lecteurs
 * coupent donc la sélection du système (classe `reading-pick`, voir main.css)
 * et se choisissent d'un appui : la bulle de commandes (ReadingSelectionMenu)
 * vient se poser dessus avec les trois gestes qui ont un sens devant un texte,
 * partager le passage, en lire la phonétique, signaler une erreur.
 *
 * Le choix se fait au passage, pas au mot : c'est la seule unité que les trois
 * commandes savent nommer. Un lien mène à un verset, pas à trois mots ; la
 * phonétique se calcule sur le texte tel qu'il se dit ; et un signalement qui
 * dit « Tehilim 23 · verset 4 » se retrouve, là où trois mots copiés se
 * cherchent.
 *
 * L'état vit dans le module, comme celui de la boussole ou du formulaire de
 * support : la bulle est posée une fois pour toutes dans App.vue, et deux
 * lecteurs de la même page (la lecture du jour en pose un par texte) ne
 * peuvent pas en ouvrir deux.
 */
export interface ReadingPassage {
  /**
   * Ce qui distingue le passage de tous les autres de la page : le fil s'en
   * sert pour le surligner, et un second appui dessus le relâche.
   */
  key: string;
  /** L'élément du passage : la bulle se pose contre lui et le suit. */
  el: HTMLElement;
  /** Le texte hébreu du passage, tel qu'il se lit aujourd'hui. */
  hebrew: string;
  /** Où le passage se trouve, en clair : « Tehilim 23 · verset 4 ». */
  place: string;
  /** L'adresse publique qui ramène à ce passage, et à lui seul. */
  url: string;
  /**
   * Le marque-page du passage : `null` là où le texte n'en prend pas (une
   * brakha, un office, un daf ne se reprennent pas à un verset).
   */
  bookmarked?: boolean | null;
  /** Pose ou retire le marque-page du passage. */
  toggleBookmark?: () => void;
}

/**
 * `shallowRef` : la valeur porte un élément du DOM, qu'un proxy réactif
 * abîmerait (Vue envelopperait ses propriétés une à une).
 */
export const readingPassage = shallowRef<ReadingPassage | null>(null);

/** La clé du passage choisi, pour que le fil sache lequel surligner. */
export const selectedPassageKey = computed(() => readingPassage.value?.key ?? null);

/** Un appui choisit le passage, un second appui dessus le relâche. */
export function selectPassage(passage: ReadingPassage): void {
  readingPassage.value = readingPassage.value?.key === passage.key ? null : passage;
}

/** Plus de passage choisi : on a touché ailleurs, ou quitté la page. */
export function clearPassage(): void {
  readingPassage.value = null;
}
