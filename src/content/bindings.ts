/**
 * Les reliures des volumes : une teinte chaude par corpus, toutes de la même
 * famille pour rester sobres (un vrai jeu de volumes, pas un arc-en-ciel).
 * Elles ne suivent pas le thème et ne changent pas en mode sombre : ce sont
 * des objets (docs/design.md, « L'étagère de la bibliothèque »).
 *
 * L'étagère de la bibliothèque, celle de Mon parcours et l'objet des cartes
 * de programme les lisent toutes ici : un séder de Michna a la même reliure
 * partout.
 */
export const CORPUS_BINDINGS: Readonly<Record<string, string>> = {
  tehilim: "#96604a",
  michna: "#7d6a4c",
  talmud: "#6d5743",
  tanakh: "#84483f",
  // Le moussar, cinquième volume de l'étude : un bronze plus doré que la
  // Michna, pour ne pas se confondre avec ses voisins de planche.
  moussar: "#86622f",
};

export function bindingOf(corpus: string): string {
  return CORPUS_BINDINGS[corpus] ?? CORPUS_BINDINGS.michna;
}
