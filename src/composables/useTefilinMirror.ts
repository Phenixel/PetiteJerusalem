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

/** D'où l'on ouvre le miroir : pour savoir si la porte se trouve. */
export type TefilinMirrorSource = "title";

export function openTefilinMirror(source: TefilinMirrorSource): void {
  open.value = true;
  analyticsService.capture("tefilin_mirror_opened", { source });
}

export function closeTefilinMirror(): void {
  open.value = false;
}
