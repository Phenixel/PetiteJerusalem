import { reactive } from "vue";

/**
 * Les sections repliées de la bibliothèque : les cinq sefarim des Tehilim.
 *
 * Cent cinquante psaumes à la suite, coupés en cinq titres, font une page
 * qu'on parcourt au pouce : on cherche un psaume, on défile. Repliés, les cinq
 * sefarim tiennent dans l'écran, avec la plage de psaumes de chacun, et l'on
 * ouvre celui qu'on veut.
 *
 * L'état vit ici, hors du composant, pour survivre à la navigation : on ouvre
 * un sefer, on lit un psaume, on revient, il est encore ouvert (et la page a la
 * hauteur qu'il faut pour que le défilement se repose où il était).
 *
 * En mémoire seulement : c'est le fil d'une visite, pas un réglage. Une
 * ouverture d'app repart sur une bibliothèque rangée.
 */

/** Sections ouvertes, en clair « corpus::livre ». */
const openBooks = reactive(new Set<string>());

function keyOf(corpus: string, livre: string): string {
  return `${corpus}::${livre}`;
}

export function useFoldedBooks() {
  function isBookOpen(corpus: string, livre: string): boolean {
    return openBooks.has(keyOf(corpus, livre));
  }

  function toggleBook(corpus: string, livre: string): void {
    const key = keyOf(corpus, livre);
    if (!openBooks.delete(key)) openBooks.add(key);
  }

  return { isBookOpen, toggleBook };
}
