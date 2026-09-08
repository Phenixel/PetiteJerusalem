import type { TextStudy } from "../models/models";
import { bookName, filterBySearch } from "./catalogSearch";

/**
 * Relais vers la recherche du catalogue (services/catalogSearch) : le partage
 * de lecture (sessionService) passe par ici, la bibliothèque et la lecture du
 * jour lisent le même module ; il n'y a plus qu'une façon de chercher un
 * texte.
 */
export class SearchService {
  static filterTextStudiesBySearch(textStudies: TextStudy[], searchTerm: string): TextStudy[] {
    return filterBySearch(textStudies, searchTerm);
  }

  static formatBookName(livre: string): string {
    return bookName(livre);
  }
}
