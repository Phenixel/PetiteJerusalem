import { EnumTypeTextStudy } from '../models/typeTextStudy'

export class TextTypeService {
  // Mapping des types vers leurs labels d'affichage
  private static readonly TYPE_LABELS: Record<EnumTypeTextStudy, string> = {
    [EnumTypeTextStudy.TalmudBavli]: 'Talmud Bavli',
    [EnumTypeTextStudy.Mishna]: 'Mishna',
    [EnumTypeTextStudy.Tehilim]: 'Tehilim',
    [EnumTypeTextStudy.Tanakh]: 'Tanakh',
  }

  // Obtenir tous les types disponibles
  static getAllTypes(): Array<{ value: EnumTypeTextStudy; label: string }> {
    return Object.entries(this.TYPE_LABELS).map(([value, label]) => ({
      value: value as EnumTypeTextStudy,
      label,
    }))
  }

  // Formater un type pour l'affichage
  static formatType(type: EnumTypeTextStudy): string {
    return this.TYPE_LABELS[type] || type
  }

  // Vérifier si un type est valide
  static isValidType(type: string): type is EnumTypeTextStudy {
    return Object.values(EnumTypeTextStudy).includes(type as EnumTypeTextStudy)
  }
}
