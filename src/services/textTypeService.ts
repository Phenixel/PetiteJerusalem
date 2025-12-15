import { EnumTypeTextStudy } from '../models/typeTextStudy'

export class TextTypeService {
  private static readonly TYPE_LABELS: Record<EnumTypeTextStudy, string> = {
    [EnumTypeTextStudy.TalmudBavli]: 'Talmud Bavli',
    [EnumTypeTextStudy.Mishna]: 'Mishna',
    [EnumTypeTextStudy.Tehilim]: 'Tehilim',
    [EnumTypeTextStudy.Tanakh]: 'Tanakh',
  }

  static getAllTypes(): Array<{ value: EnumTypeTextStudy; label: string }> {
    return Object.entries(this.TYPE_LABELS).map(([value, label]) => ({
      value: value as EnumTypeTextStudy,
      label,
    }))
  }

  static formatType(type: EnumTypeTextStudy): string {
    return this.TYPE_LABELS[type] || type
  }

  static isValidType(type: string): type is EnumTypeTextStudy {
    return Object.values(EnumTypeTextStudy).includes(type as EnumTypeTextStudy)
  }
}
