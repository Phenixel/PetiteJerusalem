import { computed, ref } from "vue";
import { analyticsService } from "../services/analyticsService";

/**
 * Le cadran des na'anou'im, ouvert depuis le titre des brahot du loulav.
 *
 * Ce que le sidour écrit est une liste : sud, nord, est, haut, bas, ouest. Ce
 * qu'il faut savoir, le loulav en main, c'est de quel côté se tourner
 * d'abord, et l'ordre est plus facile à retenir posé sur un cadran qu'en
 * ligne. La boussole du Kotel montre une direction ; celle-ci en numérote
 * six, et c'est la seule différence entre les deux.
 *
 * Même forme que useKotelCompass : un état partagé à l'échelle de l'app,
 * parce que le titre qui ouvre la fenêtre et la fenêtre elle-même vivent dans
 * deux arbres de composants séparés.
 */

const open = ref(false);

/** La fenêtre est ouverte. */
export const naanouimCompassOpen = computed(() => open.value);

export function openNaanouimCompass(): void {
  open.value = true;
  analyticsService.capture("naanouim_compass_opened");
}

export function closeNaanouimCompass(): void {
  open.value = false;
}
