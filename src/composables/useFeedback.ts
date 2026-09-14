import { ref } from "vue";

/**
 * Le formulaire de support s'ouvre de plusieurs endroits (pied de page du
 * site, onglet À propos de l'app, bas de l'accueil) : une seule fenêtre,
 * montée dans App.vue, et un état partagé pour l'ouvrir.
 */
export const isFeedbackOpen = ref(false);

export function openFeedback(): void {
  isFeedbackOpen.value = true;
}

export function closeFeedback(): void {
  isFeedbackOpen.value = false;
}
