/**
 * L'arrivée des livres sur les étagères de la bibliothèque : une fois par mois.
 *
 * Les volumes se posent un à un sur la planche, et c'est joli la première fois.
 * Quand on ouvre la bibliothèque tous les jours, c'est une demi-seconde
 * d'attente avant de pouvoir toucher un livre, tous les jours : l'animation
 * finit par se mettre en travers de ce qu'on vient faire.
 *
 * Elle se rejoue donc de loin en loin. Entre deux, les livres sont là d'emblée,
 * sans mouvement d'entrée (le soulèvement au survol, lui, reste : il répond à
 * un geste, il ne fait attendre personne).
 *
 * La date du dernier passage est retenue sur l'appareil : c'est une question
 * d'usage, pas de compte, et un appareil neuf a droit à sa première fois.
 */

const STORAGE_KEY = "pj_shelf_intro_at";

/** Un mois entre deux passages. */
const INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

function readLast(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const at = Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    // Stockage indisponible (navigation privée, mode restreint) : l'animation
    // se jouera à chaque visite, faute de pouvoir se souvenir.
    return null;
  }
}

/**
 * Tranché une fois par lancement : les deux étagères de la bibliothèque posent
 * la même question, et elles doivent avoir la même réponse.
 */
let decision: boolean | null = null;

/** L'animation d'arrivée des livres se joue-t-elle cette fois-ci ? */
export function shouldPlayShelfIntro(now: number = Date.now()): boolean {
  if (decision !== null) return decision;
  const last = readLast();
  decision = last === null || now - last >= INTERVAL_MS;
  if (decision) {
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Stockage indisponible : elle se rejouera à la prochaine visite.
    }
  }
  return decision;
}
