import { reactive } from "vue";

/**
 * Les sections repliables de la bibliothèque : les cinq sefarim des Tehilim.
 *
 * Cent cinquante psaumes à la suite, coupés en cinq titres, font une longue
 * page : un titre se replie d'un appui, et l'on range ce qu'on ne lit pas.
 * Tout est déplié au départ, comme avant : on vient chercher un psaume, il doit
 * être là, sous les yeux, sans un geste de plus.
 *
 * L'état vit ici, hors du composant, pour survivre à la navigation : on replie
 * un sefer, on lit un psaume, on revient, il est encore replié (et la page a la
 * hauteur qu'il faut pour que le défilement se repose où il était).
 *
 * En mémoire seulement : c'est le fil d'une visite, pas un réglage. Une
 * ouverture d'app repart sur une bibliothèque toute dépliée.
 */

/** Sections repliées, en clair « corpus::livre ». Tout le reste est ouvert. */
const foldedBooks = reactive(new Set<string>());

function keyOf(corpus: string, livre: string): string {
  return `${corpus}::${livre}`;
}

export function useFoldedBooks() {
  function isBookOpen(corpus: string, livre: string): boolean {
    return !foldedBooks.has(keyOf(corpus, livre));
  }

  function toggleBook(corpus: string, livre: string): void {
    const key = keyOf(corpus, livre);
    if (!foldedBooks.delete(key)) foldedBooks.add(key);
  }

  return { isBookOpen, toggleBook };
}
