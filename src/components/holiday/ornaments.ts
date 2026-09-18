import type { Component } from "vue";
import type { HolidayThemeId } from "../../services/holidayThemes";
import OrnamentChofar from "./OrnamentChofar.vue";
import OrnamentMiel from "./OrnamentMiel.vue";
import OrnamentLoulav from "./OrnamentLoulav.vue";
import OrnamentEtrog from "./OrnamentEtrog.vue";
import OrnamentToupie from "./OrnamentToupie.vue";
import OrnamentHanoukkia from "./OrnamentHanoukkia.vue";
import OrnamentFigue from "./OrnamentFigue.vue";
import OrnamentRaisin from "./OrnamentRaisin.vue";
import OrnamentCrecelle from "./OrnamentCrecelle.vue";
import OrnamentMasque from "./OrnamentMasque.vue";
import OrnamentMatsa from "./OrnamentMatsa.vue";
import OrnamentVin from "./OrnamentVin.vue";
import OrnamentTables from "./OrnamentTables.vue";
import OrnamentBle from "./OrnamentBle.vue";
import FabPomme from "./fab/FabPomme.vue";
import FabSoucca from "./fab/FabSoucca.vue";
import FabBeignet from "./fab/FabBeignet.vue";
import FabFigue from "./fab/FabFigue.vue";
import FabMeguila from "./fab/FabMeguila.vue";
import FabMatsa from "./fab/FabMatsa.vue";
import FabTables from "./fab/FabTables.vue";

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
  hanouka: [OrnamentToupie, OrnamentHanoukkia],
  toubichvat: [OrnamentRaisin, OrnamentFigue],
  pourim: [OrnamentCrecelle, OrnamentMasque],
  pessah: [OrnamentVin, OrnamentMatsa],
  chavouot: [OrnamentBle, OrnamentTables],
};

/**
 * La forme du bouton rond des horaires pour chaque fête (voir
 * HolidayFabShape), et de combien sa boîte remonte pour que le corps de la
 * forme, où l'horloge se lit, tombe au centre du bouton : la boîte fait
 * 4.5rem, le bouton 3.25rem, et le centre du corps est à `c/64` de la boîte,
 * d'où `top = 1.625rem - c/64 * 4.5rem`.
 */
export const HOLIDAY_FAB_SHAPES: Record<HolidayThemeId, { shape: Component; top: string }> = {
  tichri: { shape: FabPomme, top: "-1.05rem" },
  souccot: { shape: FabSoucca, top: "-1.35rem" },
  hanouka: { shape: FabBeignet, top: "-1.05rem" },
  toubichvat: { shape: FabFigue, top: "-1.05rem" },
  pourim: { shape: FabMeguila, top: "-0.98rem" },
  pessah: { shape: FabMatsa, top: "-0.9rem" },
  chavouot: { shape: FabTables, top: "-1.35rem" },
};
