import { computed, ref } from "vue";
import { isNativeApp } from "./useNativeApp";

/**
 * Introduction de première ouverture (onboarding).
 *
 * Des pages pleines, une idée par page : la mesure d'audience et son choix,
 * les réglages d'apparence, la lecture quotidienne, la bibliothèque et ses
 * téléchargements. Plusieurs utilisateurs ne devinaient pas à quoi servaient
 * ces écrans ; l'introduction les explique une fois, au bon moment, plutôt
 * que de compter sur la découverte.
 *
 * App native seulement. C'est là qu'on installe l'application et qu'on
 * l'ouvre pour la première fois, écran entier, sans rien d'autre autour ;
 * le site, lui, se visite le plus souvent par une page précise venue d'un
 * moteur de recherche, et quatre pages d'introduction en travers de cette
 * page-là seraient une porte fermée. Le web garde donc la bannière de
 * consentement, et ses écrans expliquent ce qu'ils font là où ils sont.
 *
 * Elle ne se montre qu'une fois : le passage est retenu sur l'appareil, et
 * tout ce qu'elle propose reste modifiable depuis les écrans concernés
 * (préférences du profil, lecture du jour, bibliothèque).
 *
 * La version vue est notée avec le passage. Les utilisateurs d'avant
 * l'introduction n'ont rien de noté : ils l'auront donc tous une fois, et une
 * seule. Changer ce numéro la reproposerait à tout le monde, ce qui n'est à
 * faire que si son contenu change vraiment.
 */

const STORAGE_KEY = "pj_onboarding_seen";

/** Version de l'introduction retenue par l'appareil qui l'a vue. */
export const ONBOARDING_VERSION = "1";

function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible (navigation privée, mode restreint) : l'introduction
    // sera proposée à chaque lancement, faute de pouvoir se souvenir.
    return null;
  }
}

const seenVersion = ref<string | null>(readSeenVersion());

/** « Revoir l'introduction » (onglet À propos) : la rouvre sans rien effacer. */
const replaying = ref(false);

/** L'introduction occupe-t-elle l'écran ? Lu aussi par la bannière de consentement. */
export const isOnboardingOpen = computed(
  () => isNativeApp && (replaying.value || seenVersion.value !== ONBOARDING_VERSION),
);

export function useOnboarding() {
  /** Fin de l'introduction, quelle qu'en soit la porte de sortie. */
  function completeOnboarding(): void {
    replaying.value = false;
    seenVersion.value = ONBOARDING_VERSION;
    try {
      localStorage.setItem(STORAGE_KEY, ONBOARDING_VERSION);
    } catch {
      // Stockage indisponible : l'introduction reste fermée pour cette session.
    }
  }

  function replayOnboarding(): void {
    replaying.value = true;
  }

  return { isOnboardingOpen, completeOnboarding, replayOnboarding };
}
