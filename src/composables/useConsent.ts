import { ref, type Ref } from "vue";

/**
 * Consentement à la mesure d'audience (PostHog).
 *
 * ePrivacy/RGPD : le suivi (cookies/localStorage, session replay) ne démarre
 * qu'après un accord explicite. Le choix est conservé en localStorage et peut
 * être modifié à tout moment (lien « Gérer les cookies » du footer et de
 * l'onglet À propos), y compris pour retirer un accord déjà donné.
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

const listeners = new Set<(choice: ConsentChoice) => void>();

export function useConsent() {
  function setChoice(newChoice: ConsentChoice): void {
    choice.value = newChoice;
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

/** Choix courant, pour du code hors composant (analyticsService). */
export function getConsentChoice(): ConsentChoice | null {
  return choice.value;
}

/** Notifie chaque décision de l'utilisateur (accord initial ou changement d'avis). */
export function onConsentChange(listener: (choice: ConsentChoice) => void): void {
  listeners.add(listener);
}
