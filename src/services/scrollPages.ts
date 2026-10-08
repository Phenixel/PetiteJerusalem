/**
 * Les pages de la forme du Sefer Torah (TorahScroll.vue) : la colonne
 * découpée toutes les quarante-deux lignes, comme une colonne de parchemin,
 * par un blanc de quelques lignes.
 *
 * Ces pages sont celles de notre colonne, pas celles d'un rouleau : nos
 * lignes ne sont pas encore les siennes (voir docs/compatibilite-textes.md,
 * les coupures de ligne du livre imprimé). Le jour où elles le seront, les
 * blancs tomberont entre ses colonnes.
 */

/** Une colonne de Sefer Torah compte quarante-deux lignes. */
export const SCROLL_LINES_PER_PAGE = 42;

/**
 * Le rang du premier mot de chaque page après la première.
 *
 * @param tops       la hauteur de chaque mot de la colonne, dans l'ordre où
 *                   ils sont écrits (en cadratins depuis le haut)
 * @param perPage    le nombre de lignes d'une page
 * @param tolerance  ce dont deux mots d'une même ligne peuvent différer
 *
 * Une ligne nouvelle se reconnaît à ce que son premier mot est plus bas que
 * tous ceux d'avant. Le blanc qu'on pose devant une page descend les mots qui
 * le suivent sans changer leur ordre : le calcul refait sur la colonne une
 * fois les blancs posés retrouve donc les mêmes pages.
 */
export function scrollPageStarts(
  tops: number[],
  perPage: number = SCROLL_LINES_PER_PAGE,
  tolerance = 0.5,
): number[] {
  const pages: number[] = [];
  let lines = 0;
  let top = -Infinity;
  tops.forEach((value, rank) => {
    if (value <= top + tolerance) return;
    if (lines > 0 && lines % perPage === 0) pages.push(rank);
    lines++;
    top = value;
  });
  return pages;
}
