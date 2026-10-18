/**
 * Les reliures des livres de la bibliothèque : une teinte chaude par rayon,
 * toutes de la même famille pour rester sobres (un vrai jeu de volumes, pas
 * un arc-en-ciel). Hors thème, identiques en mode sombre (docs/design.md,
 * « L'étagère de la bibliothèque »). L'étagère les porte, et les livres posés
 * sur la table d'étude les reprennent, comme l'étagère de Mon parcours et
 * l'objet des cartes de programme : un séder de Michna a la même reliure
 * partout.
 */
const BINDINGS: Record<string, string> = {
  tehilim: "#96604a",
  michna: "#7d6a4c",
  talmud: "#6d5743",
  tanakh: "#84483f",
  // Le moussar, cinquième volume de l'étude : un bronze plus doré que la
  // Michna, pour ne pas se confondre avec ses voisins de planche.
  moussar: "#86622f",
  // La halakha, à côté du Tanakh et du moussar sur la deuxième planche : un
  // châtaigne, le plus sombre des volumes, qui ne se confond avec aucun.
  halakha: "#5e4535",
  // The Sidour, a volume of its own only when pinned to the home page
  // (HomePinnedBooks): a caramel, the lightest of the bindings, apart from
  // the Tehilim it usually stands next to.
  sidour: "#a06a3c",
};

/** La reliure d'un rayon ; celle de la Michna pour un autre livre. */
export function bindingOf(corpus: string): string {
  return BINDINGS[corpus] ?? "#7d6a4c";
}
