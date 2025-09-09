// Service d'utilitaires généraux
export class UtilsService {
  // Générer un slug à partir d'un texte
  static generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[éèêë]/g, 'e')
      .replace(/[àâä]/g, 'a')
      .replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ûüù]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  // Valider un email
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Formater une date pour l'affichage
  static formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Formater une date courte (DD/MM/YYYY)
  static formatShortDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // Vérifier si une date est passée
  static isDatePast(date: Date): boolean {
    return new Date() > new Date(date)
  }

  // Vérifier si une date est aujourd'hui
  static isDateToday(date: Date): boolean {
    const today = new Date()
    const checkDate = new Date(date)
    return (
      today.getFullYear() === checkDate.getFullYear() &&
      today.getMonth() === checkDate.getMonth() &&
      today.getDate() === checkDate.getDate()
    )
  }

  // Obtenir le nombre de jours restants jusqu'à une date
  static getDaysUntil(date: Date): number {
    const today = new Date()
    const targetDate = new Date(date)
    const diffTime = targetDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Formater une durée relative (ex: "dans 3 jours", "il y a 2 jours")
  static formatRelativeDate(date: Date): string {
    const daysUntil = this.getDaysUntil(date)

    if (daysUntil === 0) return "Aujourd'hui"
    if (daysUntil === 1) return 'Demain'
    if (daysUntil === -1) return 'Hier'
    if (daysUntil > 0) return `Dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}`
    if (daysUntil < 0)
      return `Il y a ${Math.abs(daysUntil)} jour${Math.abs(daysUntil) > 1 ? 's' : ''}`

    return this.formatDate(date)
  }

  // Générer un ID unique
  static generateId(): string {
    return crypto.randomUUID()
  }

  // Débouncer une fonction
  static debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number,
  ): (...args: Parameters<T>) => void {
    let timeout: number
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  }
}
