import { FirestoreService } from './firestoreService'
import type { Session } from '../models/models'
import { EnumTypeTextStudy } from '../models/typeTextStudy'
import { TextTypeService } from './textTypeService'
import { DateService } from './dateService'
import { Services } from './Services'

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

  // Créer une nouvelle session
  async createSession(
    sessionData: Omit<Session, 'id' | 'createdAt' | 'isCompleted'>,
  ): Promise<string> {
    return await this.firestoreService.createSession(sessionData)
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
    const sessionData: Omit<Session, 'id' | 'createdAt' | 'isCompleted'> = {
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
}
