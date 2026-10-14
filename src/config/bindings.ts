/**
 * Les reliures des livres de la bibliothèque : une teinte chaude par rayon,
 * toutes de la même famille pour rester sobres (un vrai jeu de volumes, pas
 * un arc-en-ciel). Hors thème, identiques en mode sombre (docs/design.md,
 * « L'étagère de la bibliothèque »). L'étagère les porte, et les livres posés
 * sur la table d'étude les reprennent.
 */
const BINDINGS: Record<string, string> = {
  tehilim: "#96604a",
  michna: "#7d6a4c",
  talmud: "#6d5743",
  tanakh: "#84483f",
  // Le moussar, cinquième volume de l'étude : un bronze plus doré que la
  // Michna, pour ne pas se confondre avec ses voisins de planche.
  moussar: "#86622f",
  // La liturgie n'est pas sur l'étagère : elle prend le cuir bleu nuit du
  // sidour (components/art/ArtSiddur.vue), et son titre doré.
  sidour: "#1c3157",
  moadim: "#1c3157",
  brahot: "#1c3157",
};

const LITURGY = new Set(["sidour", "moadim", "brahot"]);

/** La reliure d'un rayon ; celle de la Michna pour un livre inconnu. */
export function bindingOf(corpus: string): string {
  return BINDINGS[corpus] ?? "#7d6a4c";
}

/** L'encre du titre sur la reliure : la dorure du sidour, le crème ailleurs. */
export function bindingInkOf(corpus: string): string {
  return LITURGY.has(corpus) ? "#dcb85e" : "#f3ead6";
}
