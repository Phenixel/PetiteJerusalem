import { firestoreService } from "./firestoreService";
import { reservationService, type ReservationForm } from "./reservationService";
import { SearchService } from "./searchService";
import { authService, type User } from "./authService";
import { generateSlug } from "./slugService";
import type {
  Session,
  TextStudy,
  TextStudyReservation,
  TextStudiesJson,
  TextStudyJsonEntry,
} from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import { TextTypeService } from "./textTypeService";
import { DateService } from "./dateService";
import textStudiesJson from "../datas/textStudies.json";

export class SessionService {
  async getAllSessions(): Promise<Session[]> {
    return await firestoreService.getSessions();
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return await firestoreService.getSessionById(sessionId);
  }

  async resolveSession(slugOrId: string): Promise<Session | null> {
    const bySlug = await firestoreService.getSessionBySlug(slugOrId);
    if (bySlug) return bySlug;
    return await firestoreService.getSessionById(slugOrId);
  }

  getTextStudiesByTypeSync(type: EnumTypeTextStudy): TextStudy[] {
    const enumToJsonLabel: Record<EnumTypeTextStudy, string> = {
      [EnumTypeTextStudy.TalmudBavli]: "Talmud Bavli",
      [EnumTypeTextStudy.Mishna]: "Mishna",
      [EnumTypeTextStudy.Tehilim]: "Tehilim",
      [EnumTypeTextStudy.Tanakh]: "Tanakh",
    };

    const label = enumToJsonLabel[type];
    const all = (textStudiesJson as TextStudiesJson).textStudies;

    return all
      .filter((t: TextStudyJsonEntry) => t.type === label)
      .map((t: TextStudyJsonEntry) => ({
        id: String(t.id),
        name: t.name,
        livre: t.livre,
        link: t.link,
        totalSections: t.totalSections,
        type,
        createdAt: new Date(),
      })) as unknown as TextStudy[];
  }

  async getTextStudiesByType(type: EnumTypeTextStudy): Promise<TextStudy[]> {
    return this.getTextStudiesByTypeSync(type);
  }

  /**
   * Renvoie les textes d'une session après application de son filtre
   * `selectedBooks` (les livres retenus à la création). Sert d'assise aux
   * statistiques d'aperçu et au filtre de disponibilité.
   */
  private getSessionTextStudies(session: Session): TextStudy[] {
    const texts = this.getTextStudiesByTypeSync(session.type);
    if (session.selectedBooks && session.selectedBooks.length > 0) {
      return texts.filter((text) => session.selectedBooks!.includes(text.livre));
    }
    return texts;
  }

  /**
   * Statistiques de réservation d'une session pour l'aperçu (carte) :
   * nombre total de sections, sections réservées et pourcentage arrondi,
   * afin de signaler d'un coup d'œil s'il reste de la disponibilité.
   */
  getSessionReservationStats(session: Session): {
    total: number;
    reserved: number;
    percentage: number;
  } {
    const total = this.getSessionTextStudies(session).reduce(
      (acc, text) => acc + text.totalSections,
      0,
    );
    const reserved = (session.reservations || []).length;
    const percentage = total > 0 ? Math.round((reserved / total) * 100) : 0;

    return { total, reserved, percentage };
  }

  /**
   * Un texte est « entièrement réservé » lorsqu'il ne reste aucune section
   * disponible. Utilisé par le filtre « disponibles uniquement ».
   */
  isTextFullyReserved(textStudy: TextStudy, session: Session): boolean {
    return (
      reservationService.getTextDisplayStatus(textStudy.id, textStudy, session).status ===
      "fully_reserved"
    );
  }

  async getBooksByType(type: EnumTypeTextStudy): Promise<string[]> {
    const texts = await this.getTextStudiesByType(type);
    const books = new Set(texts.map((t) => t.livre));
    return Array.from(books);
  }

  // === MÉTHODES D'AUTHENTIFICATION ===

  async getCurrentUser(): Promise<User | null> {
    return await authService.getCurrentUser();
  }

  // === MÉTHODES DE RÉSERVATION ===

  getReservationsBySession(session: Session): TextStudyReservation[] {
    return reservationService.getReservationsBySession(session);
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
    );
  }

  async deleteReservation(sessionId: string, reservationId: string): Promise<void> {
    return await reservationService.deleteReservation(sessionId, reservationId);
  }

  async deleteReservations(sessionId: string, reservationIds: string[]): Promise<void> {
    return await reservationService.deleteReservations(sessionId, reservationIds);
  }

  async renameGuest(sessionId: string, reservationId: string, newName: string): Promise<number> {
    return await reservationService.renameGuest(sessionId, reservationId, newName);
  }

  canUserDeleteReservation(
    reservation: TextStudyReservation,
    currentUser: User | null,
    guestEmail?: string,
  ): boolean {
    return reservationService.canUserDeleteReservation(reservation, currentUser, guestEmail);
  }

  async createReservationForUser(
    sessionId: string,
    textStudyId: string,
    section: number | undefined,
    currentUser: User | null,
    reservationForm: ReservationForm,
    guestEmailRequired: boolean = false,
  ): Promise<string> {
    return await reservationService.createReservationForUser(
      sessionId,
      textStudyId,
      section,
      currentUser,
      reservationForm,
      guestEmailRequired,
    );
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
    );
  }

  async createBatchReservationsForUser(
    sessionId: string,
    items: Array<{ textStudyId: string; section?: number }>,
    currentUser: User | null,
    reservationForm: ReservationForm,
    guestEmailRequired: boolean = false,
  ): Promise<string[]> {
    if (currentUser) {
      return await reservationService.createBatchReservations(
        sessionId,
        items,
        currentUser.id,
        undefined,
        currentUser.name,
        undefined,
      );
    } else {
      if (!reservationForm.name || (guestEmailRequired && !reservationForm.email.trim())) {
        throw new Error(
          guestEmailRequired ? "Veuillez remplir votre nom et email" : "Veuillez remplir votre nom",
        );
      }
      return await reservationService.createBatchReservations(
        sessionId,
        items,
        undefined,
        reservationService.resolveGuestId(reservationForm),
        undefined,
        reservationForm.name,
      );
    }
  }

  createLocalReservations(
    items: Array<{ textStudyId: string; section?: number }>,
    reservationIds: string[],
    currentUser: User | null,
    reservationForm: ReservationForm,
  ): TextStudyReservation[] {
    return items.map((item, index) =>
      reservationService.createLocalReservation(
        reservationIds[index],
        item.textStudyId,
        item.section,
        currentUser,
        reservationForm,
      ),
    );
  }

  async createSession(
    sessionData: Omit<Session, "id" | "createdAt" | "isCompleted" | "reservations">,
  ): Promise<string> {
    const sessionWithReservations: Omit<Session, "id" | "createdAt" | "isCompleted"> = {
      ...sessionData,
      reservations: [],
    };
    return await firestoreService.createSession(sessionWithReservations);
  }

  private async generateUniqueSlug(baseName: string, excludeSessionId?: string): Promise<string> {
    // Un nom écrit entièrement en alphabet non latin (hébreu…) donne un slug
    // vide une fois les caractères hors a-z0-9 supprimés : sans base de repli,
    // la session serait stockée avec slug "" et les liens ?session= seraient vides.
    const base = generateSlug(baseName) || "session";
    const existing = await firestoreService.getSessionBySlug(base);
    if (!existing || existing.id === excludeSessionId) return base;

    // Suffixes séquentiels d'abord (slugs lisibles : nom-1, nom-2…), mais
    // bornés : chaque essai coûte une requête Firestore, et un nom très
    // populaire en enchaînerait autant que de doublons. Au-delà, un suffixe
    // aléatoire court règle la question en un seul essai supplémentaire.
    for (let counter = 1; counter <= 3; counter++) {
      const candidate = `${base}-${counter}`;
      const found = await firestoreService.getSessionBySlug(candidate);
      if (!found || found.id === excludeSessionId) return candidate;
    }
    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async createSessionWithValidation(
    name: string,
    description: string,
    type: EnumTypeTextStudy,
    dateLimit: string,
    personId: string,
    creatorName: string,
    selectedBooks?: string[],
    guestEmailRequired: boolean = false,
  ): Promise<string> {
    if (!name || !description || !type || !dateLimit || !personId || !creatorName) {
      throw new Error("Tous les champs sont obligatoires");
    }

    const slug = await this.generateUniqueSlug(name);

    const sessionData: Omit<Session, "id" | "createdAt" | "isCompleted" | "reservations"> = {
      name,
      description,
      type,
      dateLimit: new Date(dateLimit),
      personId,
      creatorName,
      slug,
      selectedBooks,
      guestEmailRequired,
    };

    return await this.createSession(sessionData);
  }

  formatTextType(type: EnumTypeTextStudy): string {
    return TextTypeService.formatType(type);
  }

  formatDate(date: Date): string {
    return DateService.formatDate(date);
  }

  sortSessionsByDate(sessions: Session[]): Session[] {
    return [...sessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  groupTextStudiesByBook(textStudies: TextStudy[]): Record<string, TextStudy[]> {
    const grouped: Record<string, TextStudy[]> = {};

    textStudies.forEach((textStudy) => {
      if (!grouped[textStudy.livre]) {
        grouped[textStudy.livre] = [];
      }
      grouped[textStudy.livre].push(textStudy);
    });

    Object.keys(grouped).forEach((bookName) => {
      grouped[bookName] = this.sortTextStudiesByType(grouped[bookName]);
    });

    return grouped;
  }

  private sortTextStudiesByType(textStudies: TextStudy[]): TextStudy[] {
    return [...textStudies].sort((a, b) => {
      if (a.type === EnumTypeTextStudy.Tehilim) {
        const aNumber = this.extractTehilimNumber(a.name);
        const bNumber = this.extractTehilimNumber(b.name);
        if (aNumber !== null && bNumber !== null) {
          return aNumber - bNumber;
        }
      }

      return parseInt(a.id) - parseInt(b.id);
    });
  }

  private extractTehilimNumber(tehilimName: string): number | null {
    const match = tehilimName.match(/Tehilim\s+(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  isTextOrSectionReserved(
    textStudyId: string,
    section: number | undefined,
    session: Session,
  ): { isReserved: boolean; reservedBy?: string } {
    return reservationService.isTextOrSectionReserved(textStudyId, section, session);
  }

  formatBookName(bookName: string): string {
    return SearchService.formatBookName(bookName);
  }

  getTextDisplayStatus(
    textStudyId: string,
    textStudy: TextStudy,
    session: Session,
  ): { status: "available" | "fully_reserved" | "partially_reserved"; reservedBy: string | null } {
    return reservationService.getTextDisplayStatus(textStudyId, textStudy, session);
  }

  filterTextStudiesBySearch(textStudies: TextStudy[], searchTerm: string): TextStudy[] {
    return SearchService.filterTextStudiesBySearch(textStudies, searchTerm);
  }

  generateChapters(totalSections: number): number[] {
    return Array.from({ length: totalSections }, (_, i) => i + 1);
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
    );
  }

  async updateSession(
    sessionId: string,
    sessionData: {
      name: string;
      description: string;
      dateLimit: string;
      slug?: string;
      guestEmailRequired?: boolean;
    },
  ): Promise<void> {
    try {
      // Le slug est l'identifiant public qui compose le lien de partage. On ne
      // le régénère JAMAIS lors d'un renommage : sinon tous les liens déjà
      // partagés deviennent « session introuvable ». On n'en génère un que pour
      // les sessions héritées qui n'en ont pas encore.
      const slug =
        sessionData.slug?.trim() || (await this.generateUniqueSlug(sessionData.name, sessionId));
      await firestoreService.updateSession(sessionId, {
        name: sessionData.name,
        description: sessionData.description,
        dateLimit: new Date(sessionData.dateLimit),
        slug,
        updatedAt: new Date(),
        ...(sessionData.guestEmailRequired !== undefined && {
          guestEmailRequired: sessionData.guestEmailRequired,
        }),
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la session:", error);
      throw error;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      await firestoreService.updateSession(sessionId, {
        isEnded: true,
        endedAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Erreur lors de la fin de session:", error);
      throw error;
    }
  }

  canEditSession(session: Session): boolean {
    return !session.isEnded;
  }

  canEndSession(session: Session): boolean {
    return !session.isEnded;
  }

  // === MÉTHODES DE GESTION POUR LES CRÉATEURS ===

  canManageSession(session: Session, currentUser: User | null): boolean {
    if (!currentUser) return false;
    return session.personId === currentUser.id;
  }
}

export const sessionService = new SessionService();
