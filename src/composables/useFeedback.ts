import { ref } from "vue";
import type { FeedbackKind } from "../services/feedbackService";

/**
 * Le formulaire de support s'ouvre de plusieurs endroits (pied de page du
 * site, onglet À propos de l'app, bas de l'accueil) : une seule fenêtre,
 * montée dans App.vue, et un état partagé pour l'ouvrir.
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
