import type { TextStudy } from '../models/models'

export class SearchService {
  // Filtrer les textes par terme de recherche
  static filterTextStudiesBySearch(textStudies: TextStudy[], searchTerm: string): TextStudy[] {
    if (!searchTerm.trim()) return textStudies

    const searchLower = searchTerm.toLowerCase()
    return textStudies.filter((text) => {
      const hebrewName = text.name
      const frenchName = this.extractFrenchName(text.name)

      return (
        hebrewName.toLowerCase().includes(searchLower) ||
        frenchName.toLowerCase().includes(searchLower)
      )
    })
  }

  // Extraire le nom français d'un texte (entre parenthèses)
  static extractFrenchName(textName: string): string {
    const match = textName.match(/\((.*?)\)/)
    return match ? match[1] : textName
  }

  // Formater le nom du livre pour l'affichage
  static formatBookName(bookName: string): string {
    return this.extractFrenchName(bookName)
  }
}
