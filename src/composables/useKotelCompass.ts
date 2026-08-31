import { computed, ref } from "vue";
import { analyticsService } from "../services/analyticsService";

/**
 * La boussole du Kotel, ouverte de deux endroits : le titre d'un passage qui
 * se dit face à Jérusalem (la 'Amida, Moussaf) et le menu de lecture, à
 * portée de pouce tout au long de l'office.
 *
 * L'état est partagé à l'échelle de l'app, comme celui du menu de lecture :
 * le titre et le menu vivent dans deux arbres de composants séparés, et la
 * fenêtre elle-même n'est montée qu'une fois, par le lecteur de liturgie.
 */

const open = ref(false);

/** La fenêtre est ouverte. */
export const kotelCompassOpen = computed(() => open.value);

/** D'où l'on ouvre la boussole : pour savoir laquelle des deux portes sert. */
export type KotelCompassSource = "title" | "menu";

export function openKotelCompass(source: KotelCompassSource): void {
  open.value = true;
  analyticsService.capture("kotel_compass_opened", { source });
}

export function closeKotelCompass(): void {
  open.value = false;
}

// Lecteurs à l'écran qui portent un passage dit face à Jérusalem : un
// compteur plutôt qu'un drapeau, le temps qu'une page de lecture remplace
// l'autre (la suivante se monte avant que la précédente ne se démonte).
const offering = ref(0);

export function addKotelOffer(): void {
  offering.value += 1;
}

export function removeKotelOffer(): void {
  offering.value = Math.max(0, offering.value - 1);
}

/**
 * Le texte lu se dit face à Jérusalem : le menu de lecture propose alors la
 * boussole. Ailleurs (les Tehilim, une guemara), elle n'aurait rien à y
 * faire.
 */
export const kotelCompassOffered = computed(() => offering.value > 0);
