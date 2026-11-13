import { ref } from "vue";
import type { FeedbackKind } from "../services/feedbackService";

/**
 * Le formulaire de support s'ouvre de plusieurs endroits (pied de page du
 * site, page « Nous écrire », bas de l'accueil, passage d'un texte) : une
 * seule fenêtre, montée dans App.vue, et un état partagé pour l'ouvrir.
 */
export const isFeedbackOpen = ref(false);

/**
 * Ce que l'ouverture met d'avance dans le formulaire.
 *
 * Un signalement parti d'un passage de texte (voir ReadingSelectionMenu) sait
 * déjà de quoi il s'agit et où se trouve le passage : le formulaire s'ouvre
 * donc sur « une erreur », le champ des détails déjà rempli de l'endroit, des
 * premiers mots et du lien. La personne n'a plus qu'à dire ce qui cloche,
 * plutôt qu'à décrire un emplacement qu'elle n'a aucun moyen de nommer.
 */
export interface FeedbackPrefill {
  kind: FeedbackKind;
  /** Le début du champ des détails ; la personne complète à la suite. */
  details: string;
}

/** Vidé à chaque ouverture sans amorce : rien ne traîne d'une fois sur l'autre. */
export const feedbackPrefill = ref<FeedbackPrefill | null>(null);

export function openFeedback(prefill: FeedbackPrefill | null = null): void {
  feedbackPrefill.value = prefill;
  isFeedbackOpen.value = true;
}

export function closeFeedback(): void {
  isFeedbackOpen.value = false;
}

/**
 * Augmente à chaque message envoyé : la page /contact, ouverte derrière la
 * fenêtre, relit alors ses fils et montre le nouveau.
 */
export const supportVersion = ref(0);

/** Ce qui était amorcé quand le site a demandé de se connecter d'abord. */
const STASH_KEY = "pj_feedback_stash";

/**
 * Le site sans compte invite à se connecter avant d'écrire : ce qui était
 * déjà dans le formulaire (un passage signalé, des détails commencés) est
 * gardé le temps de la connexion, et la page « Nous écrire » le rouvre.
 */
export function stashFeedbackPrefill(prefill: FeedbackPrefill): void {
  if (!prefill.details.trim()) return;
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify(prefill));
  } catch {
    // Stockage indisponible : la personne réécrira, rien de grave.
  }
}

/** Rouvre le formulaire sur ce qui était amorcé avant la connexion, une fois. */
export function resumeStashedFeedback(): void {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STASH_KEY);
    sessionStorage.removeItem(STASH_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackPrefill>;
    const kinds: FeedbackKind[] = ["idea", "bug", "error", "other"];
    if (typeof parsed.details !== "string" || !kinds.includes(parsed.kind as FeedbackKind)) return;
    openFeedback({ kind: parsed.kind as FeedbackKind, details: parsed.details });
  } catch {
    // Illisible : on n'ouvre rien.
  }
}
