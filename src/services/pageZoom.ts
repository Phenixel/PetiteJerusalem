/**
 * La loupe de la forme de la page (TalmudDafPages.vue, TorahScroll.vue) : ce
 * que la taille de lecture fait de la page, à partir de la place qu'il y a
 * autour d'elle.
 *
 * Une page de Vilna ou une colonne de Sefer Torah se reconnaît à ses lignes :
 * agrandir son texte les déplacerait. La taille de lecture agrandit donc la
 * page entière, `scale` fois sa largeur ordinaire, et ses caractères suivent
 * sa largeur. Sur un ordinateur, la colonne de lecture laisse de la place de
 * chaque côté : la page y déborde d'abord, autant à gauche qu'à droite, et se
 * lit entière sans qu'on ait à la faire glisser (ce qu'une souris sans pavé
 * tactile ne sait pas faire). Elle ne se fait glisser de côté que lorsqu'elle
 * dépasse aussi cette place : sur un téléphone, où il n'y en a pas, dès le
 * premier cran.
 */
export interface PageZoomFrame {
  /** La largeur de la page agrandie, en pixels. */
  page: number;
  /** Ce dont le cadre déborde de la colonne, de chaque côté, en pixels. */
  grow: number;
}

/**
 * The narrowest daf page, in pixels. Rachi and Tossafot are written at about
 * 2 % of the page's width (8 px on a 400 px page), and a browser may refuse
 * to draw text below a minimum: the Android WebView writes nothing smaller
 * than 8 px. Below that, the commentaries come out larger than the lines the
 * page measured for them, and run into one another. On a phone, the page is
 * therefore a little wider than the screen from the first step, and slides
 * sideways; the size steps (usePageFormSize) start from there.
 */
export const MIN_DAF_PAGE = 400;

/**
 * @param scale     la taille de lecture (1 : la page à sa largeur ordinaire)
 * @param column    la largeur de la colonne de lecture
 * @param freeLeft  la place libre à gauche de la colonne
 * @param freeRight la place libre à sa droite (jusqu'au volet des
 *                  commentaires, s'il est ouvert)
 * @param natural   la largeur ordinaire de la page : celle de la colonne pour
 *                  la page du daf, pas plus de 21 cadratins pour le rouleau
 * @param least     the narrowest the page may be at its ordinary size
 *                  (MIN_DAF_PAGE for the daf); each step enlarges from there
 */
export function pageZoomFrame(
  scale: number,
  column: number,
  freeLeft: number,
  freeRight: number,
  natural: number = column,
  least = 0,
): PageZoomFrame {
  const page = scale * Math.max(Math.min(natural, column), least);
  const wanted = Math.max(0, (page - column) / 2);
  const room = Math.max(0, Math.min(freeLeft, freeRight));
  return { page, grow: Math.min(wanted, room) };
}
