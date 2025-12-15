import { firestoreService } from './firestoreService'
import { reservationService, type ReservationForm } from './reservationService'
import { SearchService } from './searchService'
import { authService, type User } from './authService'
import { UtilsService } from './Services'
import type {
  Session,
  TextStudy,
  TextStudyReservation,
  TextStudiesJson,
  TextStudyJsonEntry,
} from '../models/models'
import { EnumTypeTextStudy } from '../models/typeTextStudy'
import { TextTypeService } from './textTypeService'
import { DateService } from './dateService'
import textStudiesJson from '../datas/textStudies.json'

export class SessionService {
  async getAllSessions(): Promise<Session[]> {
    return await firestoreService.getSessions()
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return await firestoreService.getSessionById(sessionId)
  }

  async getTextStudiesByType(type: EnumTypeTextStudy): Promise<TextStudy[]> {
    const enumToJsonLabel: Record<EnumTypeTextStudy, string> = {
      [EnumTypeTextStudy.TalmudBavli]: 'Talmud Bavli',
      [EnumTypeTextStudy.Mishna]: 'Mishna',
      [EnumTypeTextStudy.Tehilim]: 'Tehilim',
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

  async getBooksByType(type: EnumTypeTextStudy): Promise<string[]> {
    const texts = await this.getTextStudiesByType(type)
    const books = new Set(texts.map((t) => t.livre))
    return Array.from(books)
  }

  // === MÉTHODES D'AUTHENTIFICATION ===

  async getCurrentUser(): Promise<User | null> {
    return await authService.getCurrentUser()
  }

  async isUserAuthenticated(): Promise<boolean> {
    return await authService.isUserAuthenticated()
  }

  async requireAuthentication(
    router: { push: (path: string) => void },
    redirectPath: string = '/',
  ): Promise<User | null> {
    return await authService.requireAuthentication(router, redirectPath)
  }

  // === MÉTHODES DE RÉSERVATION ===

  getReservationsBySession(session: Session): TextStudyReservation[] {
    return reservationService.getReservationsBySession(session)
  }

  async createReservation(
    sessionId: string,
    textStudyId: string,
    section?: number,
    userId?: string,
    guestId?: string,
    userName?: string,
    guestName?: string,
  ): Promise<string> {
    return await reservationService.createReservation(
      sessionId,
      textStudyId,
      section,
      userId,
      guestId,
      userName,
      guestName,
    )
  }

  async deleteReservation(sessionId: string, reservationId: string): Promise<void> {
    return await reservationService.deleteReservation(sessionId, reservationId)
  }
  canUserDeleteReservation(
    reservation: TextStudyReservation,
    currentUser: User | null,
    guestEmail?: string,
  ): boolean {
    return reservationService.canUserDeleteReservation(reservation, currentUser, guestEmail)
  }

  async createReservationForUser(
    sessionId: string,
    textStudyId: string,
    section: number | undefined,
    currentUser: User | null,
    reservationForm: ReservationForm,
  ): Promise<string> {
    return await reservationService.createReservationForUser(
      sessionId,
      textStudyId,
      section,
      currentUser,
      reservationForm,
    )
  }

  createLocalReservation(
    reservationId: string,
    textStudyId: string,
    section: number | undefined,
    currentUser: User | null,
    reservationForm: ReservationForm,
  ): TextStudyReservation {
    return reservationService.createLocalReservation(
      reservationId,
      textStudyId,
      section,
      currentUser,
      reservationForm,
    )
  }

  async createSession(
    sessionData: Omit<Session, 'id' | 'createdAt' | 'isCompleted' | 'reservations'>,
  ): Promise<string> {
    const sessionWithReservations: Omit<Session, 'id' | 'createdAt' | 'isCompleted'> = {
      ...sessionData,
      reservations: [],
    }
    return await firestoreService.createSession(sessionWithReservations)
  }

  async createSessionWithValidation(
    name: string,
    description: string,
    type: EnumTypeTextStudy,
    dateLimit: string,
    personId: string,
    creatorName: string,
    selectedBooks?: string[],
  ): Promise<string> {
    if (!name || !description || !type || !dateLimit || !personId || !creatorName) {
      throw new Error('Tous les champs sont obligatoires')
    }

    const slug = UtilsService.generateSlug(name)

    const sessionData: Omit<Session, 'id' | 'createdAt' | 'isCompleted' | 'reservations'> = {
      name,
      description,
      type,
      dateLimit: new Date(dateLimit),
      personId,
      creatorName,
      slug,
      selectedBooks,
    }

    return await this.createSession(sessionData)
  }

  async deleteSession(sessionId: string): Promise<void> {
    return await firestoreService.deleteSession(sessionId)
  }

  formatTextType(type: EnumTypeTextStudy): string {
    return TextTypeService.formatType(type)
  }

  formatDate(date: Date): string {
    return DateService.formatDate(date)
  }

  isSessionOverdue(session: Session): boolean {
    return DateService.isDatePast(session.dateLimit) && !session.isCompleted
  }
  filterSessionsByType(sessions: Session[], type: EnumTypeTextStudy): Session[] {
    return sessions.filter((session) => session.type === type)
  }

  sortSessionsByDate(sessions: Session[]): Session[] {
    return [...sessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  sortSessionsByDeadline(sessions: Session[]): Session[] {
    return [...sessions].sort(
      (a, b) => new Date(a.dateLimit).getTime() - new Date(b.dateLimit).getTime(),
    )
  }

  groupTextStudiesByBook(textStudies: TextStudy[]): Record<string, TextStudy[]> {
    const grouped: Record<string, TextStudy[]> = {}

    textStudies.forEach((textStudy) => {
      if (!grouped[textStudy.livre]) {
        grouped[textStudy.livre] = []
      }
      grouped[textStudy.livre].push(textStudy)
    })

    Object.keys(grouped).forEach((bookName) => {
      grouped[bookName] = this.sortTextStudiesByType(grouped[bookName])
    })

    return grouped
  }

  private sortTextStudiesByType(textStudies: TextStudy[]): TextStudy[] {
    return [...textStudies].sort((a, b) => {
      if (a.type === EnumTypeTextStudy.Tehilim) {
        const aNumber = this.extractTehilimNumber(a.name)
        const bNumber = this.extractTehilimNumber(b.name)
        if (aNumber !== null && bNumber !== null) {
          return aNumber - bNumber
        }
      }

      return parseInt(a.id) - parseInt(b.id)
    })
  }

  private extractTehilimNumber(tehilimName: string): number | null {
    const match = tehilimName.match(/Tehilim\s+(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }

  isTextOrSectionReserved(
    textStudyId: string,
    section: number | undefined,
    session: Session,
  ): { isReserved: boolean; reservedBy?: string } {
    return reservationService.isTextOrSectionReserved(textStudyId, section, session)
  }

  formatBookName(bookName: string): string {
    return SearchService.formatBookName(bookName)
  }

  getTextDisplayStatus(
    textStudyId: string,
    textStudy: TextStudy,
    session: Session,
  ): { status: 'available' | 'fully_reserved' | 'partially_reserved'; reservedBy: string | null } {
    return reservationService.getTextDisplayStatus(textStudyId, textStudy, session)
  }

  filterTextStudiesBySearch(textStudies: TextStudy[], searchTerm: string): TextStudy[] {
    return SearchService.filterTextStudiesBySearch(textStudies, searchTerm)
  }

  generateChapters(totalSections: number): number[] {
    return Array.from({ length: totalSections }, (_, i) => i + 1)
  }

  async markReservationAsCompleted(
    sessionId: string,
    reservationId: string,
    isCompleted: boolean,
  ): Promise<void> {
    return await reservationService.markReservationAsCompleted(
      sessionId,
      reservationId,
      isCompleted,
    )
  }

  // === MÉTHODES DE GESTION DES DONNÉES DE SESSION ===
  async loadSessionData(sessionId: string): Promise<{
    session: Session
    textStudies: TextStudy[]
    reservations: TextStudyReservation[]
  }> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session non trouvée')
    }

    let textStudies = await this.getTextStudiesByType(session.type)

    if (session.selectedBooks && session.selectedBooks.length > 0) {
      textStudies = textStudies.filter((text) => session.selectedBooks!.includes(text.livre))
    }

    const reservations = this.getReservationsBySession(session)

    return { session, textStudies, reservations }
  }

  getGroupedAndFilteredTextStudies(
    textStudies: TextStudy[],
    searchTerm: string,
  ): Record<string, TextStudy[]> {
    let filteredTexts = textStudies

    if (searchTerm.trim()) {
      filteredTexts = this.filterTextStudiesBySearch(textStudies, searchTerm)
    }

    return this.groupTextStudiesByBook(filteredTexts)
  }

  async updateSession(
    sessionId: string,
    sessionData: { name: string; description: string; dateLimit: string },
  ): Promise<void> {
    try {
      await firestoreService.updateSession(sessionId, {
        name: sessionData.name,
        description: sessionData.description,
        dateLimit: new Date(sessionData.dateLimit),
        updatedAt: new Date(),
      })
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la session:', error)
      throw new Error('Impossible de mettre à jour la session')
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      await firestoreService.updateSession(sessionId, {
        isEnded: true,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (error) {
      console.error('Erreur lors de la fin de session:', error)
      throw new Error('Impossible de terminer la session')
    }
  }

  canEditSession(session: Session): boolean {
    return !session.isEnded
  }

  canEndSession(session: Session): boolean {
    return !session.isEnded
  }

  // === MÉTHODES DE GESTION POUR LES CRÉATEURS ===

  async createGuestReservation(
    sessionId: string,
    textStudyId: string,
    section: number | undefined,
    guestName: string,
    guestEmail: string,
  ): Promise<string> {
    return await reservationService.createReservation(
      sessionId,
      textStudyId,
      section,
      undefined,
      guestEmail,
      undefined,
      guestName,
    )
  }

  getSessionStats(session: Session): {
    totalReservations: number
    completedReservations: number
    completionRate: number
    totalTexts: number
    reservedTexts: number
    availableTexts: number
  } {
    const reservations = session.reservations || []
    const totalReservations = reservations.length
    const completedReservations = reservations.filter((r) => r.isCompleted).length
    const completionRate =
      totalReservations > 0 ? (completedReservations / totalReservations) * 100 : 0

    return {
      totalReservations,
      completedReservations,
      completionRate: Math.round(completionRate),
      totalTexts: 0,
      reservedTexts: 0,
      availableTexts: 0,
    }
  }

  getTextReservations(session: Session, textStudyId: string): TextStudyReservation[] {
    return session.reservations?.filter((r) => r.textStudyId === textStudyId) || []
  }
  canManageSession(session: Session, currentUser: User | null): boolean {
    if (!currentUser) return false
    return session.personId === currentUser.id
  }

  getTextReservationStatus(
    textStudy: TextStudy,
    session: Session,
  ): {
    status: 'available' | 'fully_reserved' | 'partially_reserved'
    reservedBy: string | null
    reservations: TextStudyReservation[]
  } {
    const reservations = this.getTextReservations(session, textStudy.id)
    const status = reservationService.getTextDisplayStatus(textStudy.id, textStudy, session)

    return {
      ...status,
      reservations,
    }
  }

  getSessionsByCreator(sessions: Session[], creatorId: string): Session[] {
    return sessions.filter((session) => session.personId === creatorId)
  }
  getActiveSessionsByCreator(sessions: Session[], creatorId: string): Session[] {
    return this.getSessionsByCreator(sessions, creatorId).filter((session) => !session.isEnded)
  }

  getCompletedSessionsByCreator(sessions: Session[], creatorId: string): Session[] {
    return this.getSessionsByCreator(sessions, creatorId).filter((session) => session.isEnded)
  }
}

export const sessionService = new SessionService()
