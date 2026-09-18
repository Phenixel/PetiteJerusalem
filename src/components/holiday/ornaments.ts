import type { Component } from "vue";
import type { HolidayThemeId } from "../../services/holidayThemes";
import OrnamentChofar from "./OrnamentChofar.vue";
import OrnamentMiel from "./OrnamentMiel.vue";
import OrnamentLoulav from "./OrnamentLoulav.vue";
import OrnamentEtrog from "./OrnamentEtrog.vue";

/**
 * Les deux ornements de chaque thème de fête, dans l'ordre où on les pose :
 * le premier à gauche, le second à droite.
 *
 * Dessinés comme les illustrations des portes de l'accueil : des traits à la
 * couleur du texte courant (`currentColor`, donc `primary` là où on les
 * pose), un détail à la seconde couleur du thème, pas de remplissage. Ils
 * suivent le thème et l'apparence sans qu'on ait rien à régénérer. Chaque
 * dessin remplit la boîte où on le pose : c'est elle qui donne la taille.
 */
export const HOLIDAY_ORNAMENTS: Record<HolidayThemeId, [Component, Component]> = {
  tichri: [OrnamentChofar, OrnamentMiel],
  souccot: [OrnamentLoulav, OrnamentEtrog],
};
