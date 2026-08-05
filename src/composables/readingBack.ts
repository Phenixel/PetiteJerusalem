/**
 * Décision du bouton « Retour » des pages de lecture.
 *
 * Le bouton remonte d'un cran dans la hiérarchie (chapitre → liste des
 * chapitres → bibliothèque), mais il doit le faire SANS empiler d'entrée par
 * dessus celle qu'on quitte : sinon « Retour » depuis un chapitre pousse la
 * liste des chapitres, et « Retour » depuis cette liste revient en arrière…
 * sur le chapitre. Le lecteur tourne alors en rond, chapitre → texte →
 * chapitre, sans jamais sortir.
 *
 * La décision ne dépend que de l'entrée d'historique précédente, ce qui la rend
 * testable indépendamment du routeur.
 */

export interface BackContext {
  /** Chemin (sans query ni ancre) de l'entrée précédente, `null` si on est entré directement. */
  previousPath: string | null;
  /** Chemin de la page parente : liste des chapitres, ou bibliothèque du corpus. */
  parentPath: string;
  /** Vrai pour un chemin appartenant au texte qu'on est en train de quitter. */
  isCurrentTextPath: (path: string) => boolean;
  /**
   * Sur la liste des chapitres, « Retour » quitte le texte : on rend la main à
   * l'écran d'où vient le lecteur (accueil, lecture du jour, résultats…).
   * Dans un chapitre au contraire, il remonte toujours à la liste.
   */
  preferHistory: boolean;
}

/**
 * `"back"` : revenir sur l'entrée précédente (elle est déjà la bonne page).
 * `"parent"` : naviguer vers `parentPath` en REMPLAÇANT l'entrée courante.
 */
export type BackAction = "back" | "parent";

export function resolveBackNavigation(ctx: BackContext): BackAction {
  const { previousPath, parentPath, isCurrentTextPath, preferHistory } = ctx;
  // Lien direct (moteur de recherche, notification, partage) : rien derrière.
  if (previousPath === null) return "parent";
  // Le parent est déjà juste derrière : y revenir restaure aussi le défilement.
  if (previousPath === parentPath) return "back";
  // Ne jamais retourner dans le texte qu'on vient de quitter : c'est l'aller-retour sans fin.
  if (isCurrentTextPath(previousPath)) return "parent";
  return preferHistory ? "back" : "parent";
}

/** "/bibliotheque/tehilim/121?verset=3#x" → "/bibliotheque/tehilim/121" */
export function stripQuery(path: string): string {
  return path.split(/[?#]/)[0];
}
