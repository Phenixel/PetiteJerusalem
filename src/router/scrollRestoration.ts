/**
 * Restauration du défilement au retour arrière (voir scrollBehavior dans
 * router/index.ts).
 *
 * Vue Router repose la position sauvée en un seul scrollTo, juste après le
 * remontage de la page. Or les pages chargent leur contenu en asynchrone
 * (listes, textes, cartes) : à cet instant le document ne fait souvent qu'un
 * écran de haut, le navigateur écrête le défilement à zéro, et rien ne le
 * repose quand le contenu arrive. Dans l'app native, la surcouche des
 * horaires démonte la page qu'elle recouvre : chaque fermeture ramenait en
 * haut de la page au lieu de rendre la position de lecture.
 *
 * D'où cette attente : la position n'est rendue au routeur que lorsque le
 * document est assez haut pour l'atteindre. Le délai plafond couvre le cas
 * d'une page devenue plus courte entre-temps (contenu changé) : on laisse
 * alors le navigateur écrêter au plus bas, comme la restauration native.
 */

/** Cadence de vérification de la hauteur du document. */
const POLL_MS = 40;

/** Au-delà, la page ne retrouvera pas sa hauteur : on rend la main. */
const TIMEOUT_MS = 3000;

/**
 * Résout dès que la position `top` est atteignable par le défilement de la
 * fenêtre (document assez haut), ou après `timeoutMs` sinon.
 */
export function waitUntilPositionReachable(top: number, timeoutMs = TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    let remaining = timeoutMs;
    const check = () => {
      const reachable = document.documentElement.scrollHeight >= top + window.innerHeight;
      if (reachable || remaining <= 0) {
        resolve();
        return;
      }
      remaining -= POLL_MS;
      setTimeout(check, POLL_MS);
    };
    check();
  });
}
