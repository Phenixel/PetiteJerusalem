import { ref } from "vue";

/**
 * L'invitation à créer un compte sur l'accueil : proposée, puis oubliée.
 *
 * Le compte sert à beaucoup de choses (sessions, lecture du jour, rappels), et
 * l'accueil est le bon endroit pour le dire une fois : à la première ouverture,
 * juste après l'introduction sur l'app native. Le répéter à chaque visite, en
 * revanche, c'est une porte qu'on referme au nez de quelqu'un qui a déjà
 * répondu non : l'accueil est l'écran qu'on voit le plus, et il a mieux à
 * montrer que la même invitation.
 *
 * Un bouton « Ignorer » la retire donc de l'accueil, pour de bon. Elle reste
 * partout ailleurs (bibliothèque, chiourim, partage de lectures, et les
 * modales des actions qui demandent un compte) : là, elle arrive au moment où
 * le compte sert vraiment à quelque chose.
 *
 * La décision est retenue sur l'appareil, comme le passage de l'introduction :
 * elle n'a pas de compte pour la porter, c'est justement son sujet.
 */

const STORAGE_KEY = "pj_home_account_cta_dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Stockage indisponible (navigation privée, mode restreint) : l'invitation
    // sera proposée à chaque visite, faute de pouvoir se souvenir.
    return false;
  }
}

const dismissed = ref(readDismissed());

export function useHomeAccountCta() {
  /** « Ignorer » : l'accueil ne la propose plus. */
  function dismissHomeAccountCta(): void {
    dismissed.value = true;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Stockage indisponible : elle reste retirée pour cette visite.
    }
  }

  return { dismissed, dismissHomeAccountCta };
}
