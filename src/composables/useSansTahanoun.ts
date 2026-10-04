import { customRef, ref, type Ref } from "vue";
import { analyticsService } from "../services/analyticsService";

/**
 * « Sans tahanoun » : le lecteur dit à l'application que le jour n'en veut
 * pas, quand le calendrier ne peut pas le savoir. Une brit mila dans
 * l'assemblée, un marié ou un bar-mitsva présent, une maison de deuil : le
 * tahanoun tombe, et avec lui ce qui l'accompagne (voir
 * tachanun.withoutTachanun). Le réglage vit dans le menu de lecture, à
 * portée de la main pendant l'office.
 *
 * Il ne vaut que pour LA JOURNÉE où il est posé. Une simhá est une affaire
 * d'un jour ; un interrupteur resté allumé retirerait le tahanoun des
 * semaines durant sans qu'on s'en aperçoive, la page ne montrant que ce
 * qu'elle dit et jamais ce qu'elle tait. On garde donc la date civile du jour
 * où il a été allumé, et il s'éteint de lui-même au lendemain. Le
 * `localStorage` suffit : un réglage d'un jour n'a pas à survivre au vidage
 * du cache.
 */
const STORAGE_KEY = "pj-sans-tahanoun";

/** Le jour civil, en local : le jour où l'on prie, pas celui d'UTC. */
function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function readHeldOn(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Le jour où le réglage a été allumé, ou null s'il ne l'a jamais été. */
const heldOn = ref<string | null>(readHeldOn());

/** Le tahanoun est-il retiré à cette heure-là ? Les pages de tefila le demandent. */
export function isSansTahanoun(at: Date = new Date()): boolean {
  return heldOn.value !== null && heldOn.value === dayKey(at);
}

/**
 * L'état de l'interrupteur, pour le menu qui le porte. Relu à chaque lecture,
 * et non gardé comme un `computed` : celui-ci ne suivait que `heldOn`, pas
 * l'heure. L'app restée ouverte d'un jour à l'autre montrait l'interrupteur
 * encore allumé le lendemain, et chaque appui, qui demandait de l'éteindre,
 * était ignoré puisqu'il l'était déjà.
 */
export const sansTahanoun: Readonly<Ref<boolean>> = customRef((track) => ({
  get() {
    track();
    return isSansTahanoun();
  },
  set() {
    // Lecture seule : setSansTahanoun le pose.
  },
}));

export function setSansTahanoun(value: boolean): void {
  if (value === isSansTahanoun()) return;
  heldOn.value = value ? dayKey(new Date()) : null;
  try {
    if (heldOn.value) localStorage.setItem(STORAGE_KEY, heldOn.value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible : le réglage vaut pour la lecture en cours.
  }
  analyticsService.capture("sans_tahanoun_changed", { enabled: value });
}
