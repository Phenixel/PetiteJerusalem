import { FirestoreService } from './firestoreService'
import type {
  Session,
  TextStudy,
  TextStudyReservation,
  TextStudiesJson,
  TextStudyJsonEntry,
  ReservationRecord,
} from '../models/models'
import { EnumTypeTextStudy } from '../models/typeTextStudy'
import { TextTypeService } from './textTypeService'
import { DateService } from './dateService'
import { Services } from './Services'
import textStudiesJson from '../datas/textStudies.json'
import { db } from '../../firebase'
import { doc, runTransaction } from 'firebase/firestore'

export class SessionService {
  private firestoreService: FirestoreService

  constructor() {
    this.firestoreService = new FirestoreService()
  }

  // Récupérer toutes les sessions
  async getAllSessions(): Promise<Session[]> {
    return await this.firestoreService.getSessions()
  }

  // Récupérer une session par ID
  async getSessionById(sessionId: string): Promise<Session | null> {
    return await this.firestoreService.getSessionById(sessionId)
  }

  // Récupérer tous les textes d'étude par type
  async getTextStudiesByType(type: EnumTypeTextStudy): Promise<TextStudy[]> {
    // Lecture depuis le JSON local
    const enumToJsonLabel: Record<EnumTypeTextStudy, string> = {
      [EnumTypeTextStudy.TalmudBavli]: 'Talmud Bavli',
      [EnumTypeTextStudy.Mishna]: 'Mishna',
      [EnumTypeTextStudy.Tehilim]: 'Tehilim',
      [EnumTypeTextStudy.ParashaDevarim]: 'Parasha Devarim',
      [EnumTypeTextStudy.Tanakh]: 'Tanakh',
    }

    const label = enumToJsonLabel[type]
    const all = (textStudiesJson as TextStudiesJson).textStudies

    const filtered = all
      .filter((t: TextStudyJsonEntry) => t.type === label)
      .map((t: TextStudyJsonEntry) => ({
        id: String(t.id),
        name: t.name,
        livre: t.livre,
        link: t.link,
        totalSections: t.totalSections,
        type,
        createdAt: new Date(),
      })) as unknown as TextStudy[]

    return filtered
  }

  // Récupérer les réservations d'une session (depuis l'objet Session)
  getReservationsBySession(session: Session): TextStudyReservation[] {
    return session.reservations || []
  }

  // Créer une réservation (enregistrée dans le document de session)
  async createReservation(
    sessionId: string,
    textStudyId: string,
    section?: number,
    userId?: string,
    guestId?: string,
    userName?: string,
    guestName?: string,
  ): Promise<string> {
    if (!userId && !guestId) {
      throw new Error('Une réservation doit être associée à un utilisateur ou un invité')
    }

    const reservationId = crypto.randomUUID()
    const sfDocRef = doc(db, 'sessions', sessionId)

    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new Error('Document de session introuvable')
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] }
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : []

        // éviter les doublons (même textStudyId + section)
        if (
          reservations.find((r) => r.textStudyId === textStudyId && r.section === section) !==
          undefined
        ) {
          throw new Error('Cette section est déjà réservée')
        }

        // Construire l'objet de réservation sans valeurs undefined
        const newReservation: ReservationRecord = {
          id: reservationId,
          textStudyId,
          chosenByName: userName || guestName || 'Utilisateur inconnu',
          available: false,
          isCompleted: false,
          createdAt: new Date().toISOString(),
        }

        // Ajouter section seulement si défini
        if (section !== undefined) {
          newReservation.section = section
        }

        // Ajouter chosenById seulement si défini
        if (userId) {
          newReservation.chosenById = userId
        }

        // Ajouter chosenByGuestId seulement si défini
        if (guestId) {
          newReservation.chosenByGuestId = guestId
        }

        reservations.push(newReservation)
        transaction.update(sfDocRef, { reservations })
      })
    })

    return reservationId
  }

  // Supprimer une réservation par id (intégrée dans le document de session)
  async deleteReservation(sessionId: string, reservationId: string): Promise<void> {
    const sfDocRef = doc(db, 'sessions', sessionId)
    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new Error('Document de session introuvable')
        }
        const data = sfDoc.data() as { reservations?: ReservationRecord[] }
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : []
        const filtered = reservations.filter((r: ReservationRecord) => r.id !== reservationId)
        transaction.update(sfDocRef, { reservations: filtered })
      })
    })
  }

  // Créer une nouvelle session
  async createSession(
    sessionData: Omit<Session, 'id' | 'createdAt' | 'isCompleted' | 'reservations'>,
  ): Promise<string> {
    const sessionWithReservations: Omit<Session, 'id' | 'createdAt' | 'isCompleted'> = {
      ...sessionData,
      reservations: [],
    }
    return await this.firestoreService.createSession(sessionWithReservations)
  }

  // Créer une session avec validation et génération automatique
  async createSessionWithValidation(
    name: string,
    description: string,
    type: EnumTypeTextStudy,
    dateLimit: string,
    personId: string,
    creatorName: string,
  ): Promise<string> {
    // Validation des données
    if (!name || !description || !type || !dateLimit || !personId || !creatorName) {
      throw new Error('Tous les champs sont obligatoires')
    }

    // Génération du slug
    const slug = Services.generateSlug(name)

    // Création de l'objet session
    const sessionData: Omit<Session, 'id' | 'createdAt' | 'isCompleted' | 'reservations'> = {
      name,
      description,
      type,
      dateLimit: new Date(dateLimit),
      personId,
      creatorName,
      slug,
    }

    return await this.createSession(sessionData)
  }

  // Mettre à jour une session
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<Session, 'id' | 'createdAt'>>,
  ): Promise<void> {
    return await this.firestoreService.updateSession(sessionId, updates)
  }

  // Supprimer une session
  async deleteSession(sessionId: string): Promise<void> {
    return await this.firestoreService.deleteSession(sessionId)
  }

  // Formater le type de texte pour l'affichage
  formatTextType(type: EnumTypeTextStudy): string {
    return TextTypeService.formatType(type)
  }

  // Formater la date pour l'affichage
  formatDate(date: Date): string {
    return DateService.formatDate(date)
  }

  // Vérifier si une session est en retard (pour usage futur)
  isSessionOverdue(session: Session): boolean {
    return DateService.isDatePast(session.dateLimit) && !session.isCompleted
  }

  // Filtrer les sessions par type
  filterSessionsByType(sessions: Session[], type: EnumTypeTextStudy): Session[] {
    return sessions.filter((session) => session.type === type)
  }

  // Trier les sessions par date de création (plus récentes en premier)
  sortSessionsByDate(sessions: Session[]): Session[] {
    return [...sessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  // Trier les sessions par date limite (plus proches en premier)
  sortSessionsByDeadline(sessions: Session[]): Session[] {
    return [...sessions].sort(
      (a, b) => new Date(a.dateLimit).getTime() - new Date(b.dateLimit).getTime(),
    )
  }

  // Grouper les textes par livre
  groupTextStudiesByBook(textStudies: TextStudy[]): Record<string, TextStudy[]> {
    const grouped: Record<string, TextStudy[]> = {}

    textStudies.forEach((textStudy) => {
      if (!grouped[textStudy.livre]) {
        grouped[textStudy.livre] = []
      }
      grouped[textStudy.livre].push(textStudy)
    })

    // Trier les textes dans chaque groupe selon leur type
    Object.keys(grouped).forEach((bookName) => {
      grouped[bookName] = this.sortTextStudiesByType(grouped[bookName])
    })

    return grouped
  }

  // Trier les textes selon leur type et leur nom
  private sortTextStudiesByType(textStudies: TextStudy[]): TextStudy[] {
    return [...textStudies].sort((a, b) => {
      // Pour les Tehilim, trier par numéro
      if (a.type === EnumTypeTextStudy.Tehilim) {
        const aNumber = this.extractTehilimNumber(a.name)
        const bNumber = this.extractTehilimNumber(b.name)
        if (aNumber !== null && bNumber !== null) {
          return aNumber - bNumber
        }
      }

      // Pour les autres types, trier alphabétiquement par nom français
      const aName = this.extractFrenchName(a.name)
      const bName = this.extractFrenchName(b.name)
      return aName.localeCompare(bName, 'fr')
    })
  }

  // Extraire le numéro d'un Tehilim
  private extractTehilimNumber(tehilimName: string): number | null {
    const match = tehilimName.match(/Tehilim\s+(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }

  // Extraire le nom français d'un texte (entre parenthèses)
  private extractFrenchName(textName: string): string {
    const match = textName.match(/\((.*?)\)/)
    return match ? match[1] : textName
  }

  // Vérifier si un texte ou une section est réservé
  isTextOrSectionReserved(
    textStudyId: string,
    section: number | undefined,
    session: Session,
  ): { isReserved: boolean; reservedBy?: string } {
    const reservations = this.getReservationsBySession(session)
    const reservation = reservations.find(
      (r) => r.textStudyId === textStudyId && r.section === section,
    )

    if (reservation) {
      return {
        isReserved: true,
        reservedBy:
          reservation.chosenByName || reservation.chosenById || reservation.chosenByGuestId,
      }
    }

    return { isReserved: false }
  }

  // Formater le nom du livre pour l'affichage
  formatBookName(bookName: string): string {
    return this.extractFrenchName(bookName)
  }

  // Obtenir le statut d'affichage d'un texte
  getTextDisplayStatus(
    textStudyId: string,
    textStudy: TextStudy,
    session: Session,
  ): { status: 'available' | 'fully_reserved' | 'partially_reserved'; reservedBy: string | null } {
    const reservations = this.getReservationsBySession(session)
    const textReservations = reservations.filter((r) => r.textStudyId === textStudyId)
    const chapterReservations = textReservations.filter((r) => r.section !== undefined)

    if (chapterReservations.length === 0) {
      return { status: 'available', reservedBy: null }
    }

    // Si tous les chapitres sont réservés par la même personne
    if (chapterReservations.length === textStudy.totalSections) {
      const firstReservation = chapterReservations[0]
      const allSamePerson = chapterReservations.every(
        (r) => r.chosenByName === firstReservation.chosenByName,
      )

      if (allSamePerson && firstReservation.chosenByName) {
        return { status: 'fully_reserved', reservedBy: firstReservation.chosenByName }
      }
    }

    // Si certains chapitres sont réservés mais pas tous
    if (chapterReservations.length > 0 && chapterReservations.length < textStudy.totalSections) {
      return { status: 'partially_reserved', reservedBy: null }
    }

    // Si tous les chapitres sont réservés par des personnes différentes
    if (chapterReservations.length === textStudy.totalSections) {
      const uniqueNames = [
        ...new Set(chapterReservations.map((r) => r.chosenByName).filter(Boolean)),
      ]
      return { status: 'fully_reserved', reservedBy: uniqueNames.join(', ') }
    }

    return { status: 'available', reservedBy: null }
  }

  // Vérifier si tous les chapitres d'un texte sont réservés par la même personne
  isTextFullyReservedBySamePerson(
    textStudyId: string,
    textStudy: TextStudy,
    session: Session,
  ): { isFullyReserved: boolean; reservedBy: string | null } {
    const reservations = this.getReservationsBySession(session)
    const textReservations = reservations.filter((r) => r.textStudyId === textStudyId)
    const chapterReservations = textReservations.filter((r) => r.section !== undefined)

    // Si aucun chapitre n'est réservé, le texte n'est pas réservé
    if (chapterReservations.length === 0) {
      return { isFullyReserved: false, reservedBy: null }
    }

    // Vérifier si tous les chapitres sont réservés
    const allChaptersReserved = chapterReservations.length === textStudy.totalSections

    if (!allChaptersReserved) {
      return { isFullyReserved: false, reservedBy: null }
    }

    // Vérifier si tous les chapitres sont réservés par la même personne
    const firstReservation = chapterReservations[0]
    const allSamePerson = chapterReservations.every(
      (r) => r.chosenByName === firstReservation.chosenByName,
    )

    return {
      isFullyReserved: true,
      reservedBy:
        allSamePerson && firstReservation.chosenByName ? firstReservation.chosenByName : null,
    }
  }

  // Filtrer les textes par terme de recherche
  filterTextStudiesBySearch(textStudies: TextStudy[], searchTerm: string): TextStudy[] {
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

  // Générer la liste des chapitres
  generateChapters(totalSections: number): number[] {
    return Array.from({ length: totalSections }, (_, i) => i + 1)
  }
}
