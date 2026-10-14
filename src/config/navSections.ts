/**
 * Les deux grandes sections de lecture de l'app, chacune un onglet de la
 * barre du bas : le Sidour, ce qu'on dit (tefilot, brahot, textes des fêtes),
 * et l'Étude, ce qu'on apprend (la bibliothèque, les chiourim, le partage).
 *
 * Les textes de liturgie gardent leur adresse sous /bibliotheque/<corpus>/… :
 * elle est publiée (widgets, liens partagés, pages indexées, positions de
 * lecture synchronisées) et une version installée de l'app la lit encore. Ils
 * se rangent pourtant dans le Sidour : c'est l'adresse, pas la route, qui dit
 * à quelle section une page appartient.
 *
 * Module sans dépendance : la barre du bas est dans le chargement initial.
 */

/** La page du Sidour. */
export const SIDOUR_PATH = "/sidour";

/** La page d'entrée de l'Étude : la bibliothèque. */
export const STUDY_PATH = "/bibliotheque";

/**
 * Les corpus de liturgie (leurs pages de liste mènent au Sidour). `slihot`
 * n'est plus un corpus, mais son ancienne adresse reste dans la nature.
 */
export const LITURGY_CORPORA = ["sidour", "moadim", "brahot", "slihot"] as const;

const SIDOUR_SECTION = new RegExp(
  `^(?:${SIDOUR_PATH}|${STUDY_PATH}/(?:${LITURGY_CORPORA.join("|")}))(?:/|$)`,
);
const STUDY_SECTION = /^\/(?:bibliotheque|chiourim|share-reading)(?:\/|$)/;

/** L'adresse appartient au Sidour : sa page, ou un texte de liturgie. */
export function isSidourPath(path: string): boolean {
  return SIDOUR_SECTION.test(path);
}

/** L'adresse appartient à l'Étude : bibliothèque, chiourim, partage. */
export function isStudyPath(path: string): boolean {
  return !isSidourPath(path) && STUDY_SECTION.test(path);
}
