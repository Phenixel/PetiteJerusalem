import { computed, ref } from "vue";

/**
 * Les sections de la tefila ouverte (Sidour, Sli'hot), publiées par la page
 * de lecture pour le menu de navigation flottant (TefilaSectionNav) : au lieu
 * du bouton « remonter en haut », un bouton qui se déplie en petit panneau et
 * mène d'une section à l'autre de l'office.
 *
 * État partagé à l'échelle de l'app : ScrollToTop (global, App.vue) s'efface
 * quand une tefila publie ses sections, le panneau le remplace.
 */
export interface TefilaNavSection {
  /** Offset du bloc dans la section : l'ancre `data-block-anchor` du rendu. */
  offset: number;
  /** Titre du bloc dans la langue du lecteur. */
  label: string;
}

const sections = ref<TefilaNavSection[]>([]);

export function setTefilaNavSections(list: TefilaNavSection[]): void {
  sections.value = list;
}

export const tefilaNavSections = computed(() => sections.value);

/** Une tefila est ouverte : son menu remplace le bouton de remontée. */
export const tefilaNavActive = computed(() => sections.value.length > 0);
