import { ref } from "vue";
import type { Router } from "vue-router";

/**
 * L'objectif qu'on vient de créer, de Nouvel objectif à Mon parcours : la
 * création le confie, Mon parcours le reçoit et le fait arriver (le volume
 * tombe sur sa planche, l'habitude se glisse dans sa liste). Une seule fois,
 * en mémoire : rien dans l'adresse, rien qui se rejoue au rechargement ni au
 * retour.
 */
const arriving = ref<string | null>(null);

/** Confie l'objectif créé, et revient sur Mon parcours. */
export function arriveOnParcours(router: Router, objectiveId: string): void {
  arriving.value = objectiveId;
  // Venu de Mon parcours : on y revient en arrière, sans l'empiler deux fois.
  const back = (window.history.state as { back?: unknown } | null)?.back;
  if (back === "/parcours") router.back();
  else void router.replace("/parcours");
}

/** Mon parcours prend l'objectif qui arrive : le suivant ne le reverra pas. */
export function takeArrival(): string | null {
  const id = arriving.value;
  arriving.value = null;
  return id;
}
