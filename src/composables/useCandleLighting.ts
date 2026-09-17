import { computed, ref } from "vue";
import {
  candleLightingChoice,
  candleLightingStore,
  setCandleLightingChoice,
} from "../services/zmanimService";

/**
 * L'écart d'allumage suivi : 18, 20, 30 ou 40 minutes avant la chkia.
 *
 * C'est l'usage d'une COMMUNAUTÉ, pas d'une ville. Petah Tikva en a deux,
 * Safed et Tibériade aussi, et un Français installé à Jérusalem peut garder
 * celui de sa communauté. L'application propose donc le défaut du lieu, et
 * laisse le changer.
 *
 * Gardé sur l'APPAREIL seulement, et non dans le compte, contrairement à
 * l'avis suivi : l'avis est une décision de fond, qu'on emporte d'un écran à
 * l'autre ; l'allumage suit la communauté où l'on prie, et déménage donc avec
 * l'appareil qu'on a en main. `null` veut dire « l'usage du lieu ».
 */

// zmanimService a déjà lu le stockage à son chargement : on repart de ce
// qu'il en a tiré, plutôt que de le relire.
const minutes = ref<number | null>(candleLightingChoice());

/** Le choix est-il déjà celui d'une personne, et non le défaut ? */
let known = candleLightingStore.read() !== null;

function apply(value: number | null): void {
  minutes.value = value;
  setCandleLightingChoice(value);
}

/** Reprend le choix gardé par le natif quand le localStorage n'a rien. */
async function restoreFromDevice(): Promise<void> {
  if (known) return;
  const saved = await candleLightingStore.restore();
  // La personne a pu choisir pendant l'attente : son geste l'emporte.
  if (saved !== null && !known) apply(saved);
}

export function useCandleLighting() {
  void restoreFromDevice();

  /** Pose un écart, ou rend la main à l'usage du lieu avec `null`. */
  function choose(value: number | null): void {
    known = value !== null;
    apply(value);
    if (value !== null) candleLightingStore.write(value);
  }

  return { minutes: computed(() => minutes.value), choose };
}
