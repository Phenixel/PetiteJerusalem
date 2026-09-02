import { computed, ref } from "vue";
import { analyticsService } from "../services/analyticsService";

/**
 * Le miroir des téfilines, ouvert depuis le titre du passage où on les pose.
 *
 * Le bayit de la tête se place à un endroit précis, et c'est le seul endroit
 * du corps qu'on ne voit pas : au-dessus de la naissance des cheveux, centré
 * entre les yeux, droit. On le pose donc à l'aveugle, en tâtonnant du bout des
 * doigts, ou devant le miroir de la salle de bain qui est rarement là où l'on
 * prie. La caméra frontale, elle, est dans la poche.
 *
 * Même forme que la boussole du Kotel (useKotelCompass) : un état partagé à
 * l'échelle de l'app, parce que le titre qui ouvre la fenêtre et la fenêtre
 * elle-même vivent dans deux arbres de composants séparés.
 */

const open = ref(false);

/** La fenêtre est ouverte. */
export const tefilinMirrorOpen = computed(() => open.value);

/** D'où l'on ouvre le miroir : le titre du passage, ou le menu de lecture. */
export type TefilinMirrorSource = "title" | "menu";

export function openTefilinMirror(source: TefilinMirrorSource): void {
  open.value = true;
  analyticsService.capture("tefilin_mirror_opened", { source });
}

export function closeTefilinMirror(): void {
  open.value = false;
}

// Lecteurs à l'écran qui portent le passage des téfilines : un compteur
// plutôt qu'un drapeau, le temps qu'une page de lecture remplace l'autre (la
// suivante se monte avant que la précédente ne se démonte).
const offering = ref(0);

export function addMirrorOffer(): void {
  offering.value += 1;
}

export function removeMirrorOffer(): void {
  offering.value = Math.max(0, offering.value - 1);
}

/**
 * Le texte lu contient la pose des téfilines : le menu de lecture propose
 * alors le miroir. Le titre du passage le porte déjà, mais il est loin dès
 * qu'on a commencé à lire, et c'est les mains prises qu'on cherche à se voir.
 * Ailleurs (Min'ha, Arvit, une guemara), il n'aurait rien à y faire.
 */
export const tefilinMirrorOffered = computed(() => offering.value > 0);
