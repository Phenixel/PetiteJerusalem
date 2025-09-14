import { FirestoreService } from './firestoreService'
import { ReservationService, type ReservationForm } from './reservationService'
import { SearchService } from './searchService'
import { AuthService, type User } from './authService'
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
  private firestoreService: FirestoreService
  private reservationService: ReservationService
  private searchService: SearchService
  private authService: AuthService

  constructor() {
    this.firestoreService = new FirestoreService()
    this.reservationService = new ReservationService()
    this.searchService = new SearchService()
    this.authService = new AuthService()
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

  // === MÉTHODES D'AUTHENTIFICATION ===

  // Récupérer l'utilisateur connecté
  async getCurrentUser(): Promise<User | null> {
    return await this.authService.getCurrentUser()
  }

  // Vérifier si l'utilisateur est connecté
  async isUserAuthenticated(): Promise<boolean> {
    return await this.authService.isUserAuthenticated()
  }

  // Rediriger si pas d'utilisateur connecté
  async requireAuthentication(
    router: { push: (path: string) => void },
    redirectPath: string = '/',
  ): Promise<User | null> {
    return await this.authService.requireAuthentication(router, redirectPath)
  }

  // === MÉTHODES DE RÉSERVATION ===

  // Récupérer les réservations d'une session (depuis l'objet Session)
  getReservationsBySession(session: Session): TextStudyReservation[] {
    return this.reservationService.getReservationsBySession(session)
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
    return await this.reservationService.createReservation(
      sessionId,
      textStudyId,
      section,
      userId,
      guestId,
      userName,
      guestName,
    )
  }

  // Supprimer une réservation par id (intégrée dans le document de session)
  async deleteReservation(sessionId: string, reservationId: string): Promise<void> {
    return await this.reservationService.deleteReservation(sessionId, reservationId)
  }

  // Vérifier si l'utilisateur peut supprimer une réservation
  canUserDeleteReservation(
    reservation: TextStudyReservation,
    currentUser: User | null,
    guestEmail?: string,
  ): boolean {
    return this.reservationService.canUserDeleteReservation(reservation, currentUser, guestEmail)
  }

  // Créer une réservation pour un utilisateur connecté ou un invité
  async createReservationForUser(
    sessionId: string,
    textStudyId: string,
    section: number | undefined,
    currentUser: User | null,
    reservationForm: ReservationForm,
  ): Promise<string> {
    return await this.reservationService.createReservationForUser(
      sessionId,
      textStudyId,
      section,
      currentUser,
      reservationForm,
    )
  }

  // Créer une réservation locale pour l'interface
  createLocalReservation(
    reservationId: string,
    textStudyId: string,
    section: number | undefined,
    currentUser: User | null,
    reservationForm: ReservationForm,
  ): TextStudyReservation {
    return this.reservationService.createLocalReservation(
      reservationId,
      textStudyId,
      section,
      currentUser,
      reservationForm,
    )
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
    const slug = UtilsService.generateSlug(name)

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
      const aName = SearchService.extractFrenchName(a.name)
      const bName = SearchService.extractFrenchName(b.name)
      return aName.localeCompare(bName, 'fr')
    })
  }

  // Extraire le numéro d'un Tehilim
  private extractTehilimNumber(tehilimName: string): number | null {
    const match = tehilimName.match(/Tehilim\s+(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }

  // Vérifier si un texte ou une section est réservé
  isTextOrSectionReserved(
    textStudyId: string,
    section: number | undefined,
    session: Session,
  ): { isReserved: boolean; reservedBy?: string } {
    return this.reservationService.isTextOrSectionReserved(textStudyId, section, session)
  }

  // Formater le nom du livre pour l'affichage
  formatBookName(bookName: string): string {
    return SearchService.formatBookName(bookName)
  }

  // Obtenir le statut d'affichage d'un texte
  getTextDisplayStatus(
    textStudyId: string,
    textStudy: TextStudy,
    session: Session,
  ): { status: 'available' | 'fully_reserved' | 'partially_reserved'; reservedBy: string | null } {
    return this.reservationService.getTextDisplayStatus(textStudyId, textStudy, session)
  }

  // Filtrer les textes par terme de recherche
  filterTextStudiesBySearch(textStudies: TextStudy[], searchTerm: string): TextStudy[] {
    return SearchService.filterTextStudiesBySearch(textStudies, searchTerm)
  }

  // Générer la liste des chapitres
  generateChapters(totalSections: number): number[] {
    return Array.from({ length: totalSections }, (_, i) => i + 1)
  }

  // Marquer une réservation comme complétée
  async markReservationAsCompleted(
    sessionId: string,
    reservationId: string,
    isCompleted: boolean,
  ): Promise<void> {
    return await this.reservationService.markReservationAsCompleted(
      sessionId,
      reservationId,
      isCompleted,
    )
  }

  // === MÉTHODES DE GESTION DES DONNÉES DE SESSION ===

  // Charger les données complètes d'une session
  async loadSessionData(sessionId: string): Promise<{
    session: Session
    textStudies: TextStudy[]
    reservations: TextStudyReservation[]
  }> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session non trouvée')
    }

    const textStudies = await this.getTextStudiesByType(session.type)
    const reservations = this.getReservationsBySession(session)

    return { session, textStudies, reservations }
  }

  // Grouper et filtrer les textes pour l'affichage
  getGroupedAndFilteredTextStudies(
    textStudies: TextStudy[],
    searchTerm: string,
  ): Record<string, TextStudy[]> {
    let filteredTexts = textStudies

    // Filtrer par terme de recherche si présent
    if (searchTerm.trim()) {
      filteredTexts = this.filterTextStudiesBySearch(textStudies, searchTerm)
    }

    return this.groupTextStudiesByBook(filteredTexts)
  }

  // Mettre à jour une session
  async updateSession(
    sessionId: string,
    sessionData: { name: string; description: string; dateLimit: string },
  ): Promise<void> {
    try {
      await this.firestoreService.updateSession(sessionId, {
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

  // Marquer une session comme terminée
  async endSession(sessionId: string): Promise<void> {
    try {
      await this.firestoreService.updateSession(sessionId, {
        isEnded: true,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (error) {
      console.error('Erreur lors de la fin de session:', error)
      throw new Error('Impossible de terminer la session')
    }
  }

  // Vérifier si une session peut être modifiée
  canEditSession(session: Session): boolean {
    // Une session peut être modifiée si elle n'est pas terminée
    return !session.isEnded
  }

  // Vérifier si une session peut être terminée
  canEndSession(session: Session): boolean {
    // Une session peut être terminée si elle n'est pas déjà terminée
    return !session.isEnded
  }
}
