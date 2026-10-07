/**
 * La loupe de la page du daf (TalmudDafPages.vue) : ce que la taille de
 * lecture fait de la page, à partir de la place qu'il y a autour d'elle.
 *
 * La page agrandie prend `scale` fois la largeur de la colonne de lecture.
 * Sur un ordinateur, cette colonne laisse de la place de chaque côté : la page
 * y déborde d'abord, autant à gauche qu'à droite, et se lit entière sans
 * qu'on ait à la faire glisser (ce qu'une souris sans pavé tactile ne sait
 * pas faire). Elle ne se fait glisser de côté que lorsqu'elle dépasse aussi
 * cette place : sur un téléphone, où il n'y en a pas, dès le premier cran.
 */
export interface DafZoomFrame {
  /** La largeur de la page agrandie, en pixels. */
  page: number;
  /** Ce dont le cadre déborde de la colonne, de chaque côté, en pixels. */
  grow: number;
}

/**
 * @param scale     la taille de lecture (1 : la page à la largeur de la colonne)
 * @param column    la largeur de la colonne de lecture
 * @param freeLeft  la place libre à gauche de la colonne
 * @param freeRight la place libre à sa droite (jusqu'au volet des
 *                  commentaires, s'il est ouvert)
 */
export function dafZoomFrame(
  scale: number,
  column: number,
  freeLeft: number,
  freeRight: number,
): DafZoomFrame {
  const page = scale * column;
  const wanted = Math.max(0, (page - column) / 2);
  const room = Math.max(0, Math.min(freeLeft, freeRight));
  return { page, grow: Math.min(wanted, room) };
}
