import { ref, type Ref } from "vue";

/**
 * Consentement à la mesure d'audience (PostHog).
 *
 * ePrivacy/RGPD : le suivi (cookies/localStorage, session replay) ne démarre
 * qu'après un accord explicite. Le choix est conservé en localStorage et peut
 * être modifié à tout moment (lien « Gérer les cookies » du footer et du
 * profil de l'app), y compris pour retirer un accord déjà donné.
 */

export type ConsentChoice = "granted" | "denied";

const STORAGE_KEY = "pj_analytics_consent";

function readStoredChoice(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

// null = pas encore choisi : la bannière est affichée.
const choice: Ref<ConsentChoice | null> = ref(readStoredChoice());

/**
 * La dernière décision, à part de l'affichage de la bannière. Rouvrir la
 * bannière remet `choice` à null pour la montrer, mais la décision reste
 * appliquée tant qu'elle n'est pas modifiée : après un refus, ce qui se
 * passe pendant que la bannière est rouverte ne se garde pas pour plus tard.
 */
let applied: ConsentChoice | null = choice.value;

const listeners = new Set<(choice: ConsentChoice) => void>();

export function useConsent() {
  function setChoice(newChoice: ConsentChoice): void {
    choice.value = newChoice;
    applied = newChoice;
    try {
      localStorage.setItem(STORAGE_KEY, newChoice);
    } catch {
      // Stockage indisponible : le choix vaut pour la session en cours.
    }
    listeners.forEach((listener) => listener(newChoice));
  }

  /** Ré-affiche la bannière (le choix courant reste appliqué tant qu'il n'est pas modifié). */
  function reopen(): void {
    choice.value = null;
  }

  return { choice, setChoice, reopen };
}

/**
 * La décision en vigueur, pour du code hors composant (analyticsService) :
 * la dernière prise, même bannière rouverte ; null tant qu'aucune ne l'a été.
 */
export function getConsentChoice(): ConsentChoice | null {
  return applied;
}

/**
 * Notifie chaque décision de l'utilisateur (accord initial ou changement
 * d'avis) ; renvoie de quoi se désabonner.
 */
export function onConsentChange(listener: (choice: ConsentChoice) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
