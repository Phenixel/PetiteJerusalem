import {
  collection,
  doc,
  addDoc,
  Timestamp,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  FirestoreError,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import type { Session } from "../models/models";
import { isReservationShape } from "./reservationShape";

// Durée de vie du cache de la liste des sessions. Court : les réservations
// des autres participants doivent apparaître rapidement.
const SESSIONS_CACHE_TTL_MS = 60_000;

/**
 * Erreur levée par FirestoreService : conserve le code Firestore d'origine
 * ("permission-denied", "unavailable"…) pour que l'UI adapte son message.
 */
class FirestoreOperationError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = "FirestoreOperationError";
    this.code = code;
  }
}

/** Un horodatage Firestore en Date ; undefined pour tout le reste. */
function toDate(value: unknown): Date | undefined {
  return value instanceof Timestamp ? value.toDate() : undefined;
}

class FirestoreService {
  private sessionsCache: { data: Session[]; fetchedAt: number } | null = null;
  private sessionsCachePromise: Promise<Session[]> | null = null;
  /** Avance à chaque invalidation : voir `getSessions`. */
  private sessionsCacheGeneration = 0;

  // === MÉTHODES UTILITAIRES ===

  /**
   * Un document de session tel que l'app le lit. Les règles ne typent ni les
   * dates ni le contenu de `reservations` : une date posée en chaîne
   * (`createdAt: "x"`) faisait lever `toDate`, et `getSessions` rejetait en
   * entier, liste et accueil du partage compris, pour tout le monde. Une date
   * illisible prend donc la valeur de repli, et une réservation sans forme
   * est écartée (isReservationShape).
   */
  private convertToSession(doc: QueryDocumentSnapshot<DocumentData>): Session {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: toDate(data.createdAt) ?? new Date(),
      dateLimit: toDate(data.dateLimit) ?? new Date(),
      slug: typeof data.slug === "string" ? data.slug : "",
      endedAt: toDate(data.endedAt),
      updatedAt: toDate(data.updatedAt),
      hiddenAt: toDate(data.hiddenAt),
      cycleStartedAt: toDate(data.cycleStartedAt),
      lastCycleStartedAt: toDate(data.lastCycleStartedAt),
      lastCycleEndedAt: toDate(data.lastCycleEndedAt),
      reservations: Array.isArray(data.reservations)
        ? data.reservations.filter(isReservationShape)
        : data.reservations,
    } as Session;
  }

  private handleFirestoreError(error: unknown, operation: string): never {
    console.error(`Erreur Firestore lors de ${operation}:`, error);
    const code = error instanceof FirestoreError ? error.code : null;
    throw new FirestoreOperationError(`Erreur lors de ${operation}. Veuillez réessayer.`, code);
  }

  /** À appeler après toute écriture qui modifie une session ou ses réservations. */
  invalidateSessionsCache(): void {
    this.sessionsCache = null;
    this.sessionsCachePromise = null;
    this.sessionsCacheGeneration++;
  }

  // === MÉTHODES SESSION ===

  async createSession(session: Omit<Session, "id" | "createdAt">): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, "sessions"), {
        ...session,
        createdAt: Timestamp.now(),
      });
      this.invalidateSessionsCache();
      return docRef.id;
    } catch (error) {
      this.handleFirestoreError(error, "création de la session");
    }
  }

  async getSessions(): Promise<Session[]> {
    if (this.sessionsCache && Date.now() - this.sessionsCache.fetchedAt < SESSIONS_CACHE_TTL_MS) {
      return this.sessionsCache.data;
    }
    // Déduplique les requêtes concurrentes (plusieurs composants au montage).
    if (this.sessionsCachePromise) {
      return this.sessionsCachePromise;
    }
    // Une lecture partie avant une écriture rapporte l'état d'avant : elle
    // ne remplit le cache (ni n'efface la lecture suivante) que si aucune
    // invalidation n'est passée entre-temps.
    const generation = this.sessionsCacheGeneration;
    this.sessionsCachePromise = (async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "sessions"));
        const sessions = querySnapshot.docs.map((doc) => this.convertToSession(doc));
        if (generation === this.sessionsCacheGeneration) {
          this.sessionsCache = { data: sessions, fetchedAt: Date.now() };
        }
        return sessions;
      } catch (error) {
        this.handleFirestoreError(error, "récupération des sessions");
      } finally {
        if (generation === this.sessionsCacheGeneration) this.sessionsCachePromise = null;
      }
    })();
    return this.sessionsCachePromise;
  }

  /**
   * Les sessions marquées perpétuelles (une seule en pratique), sans
   * télécharger toute la collection et ses réservations.
   */
  async getPerpetualSessions(): Promise<Session[]> {
    try {
      const snapshot = await getDocs(
        query(collection(db, "sessions"), where("perpetual", "==", true)),
      );
      return snapshot.docs.map((doc) => this.convertToSession(doc));
    } catch (error) {
      this.handleFirestoreError(error, "récupération de la chaîne perpétuelle");
    }
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    try {
      const docRef = doc(db, "sessions", sessionId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return this.convertToSession(docSnap);
      }
      return null;
    } catch (error) {
      this.handleFirestoreError(error, "récupération de la session par ID");
    }
  }

  async getSessionBySlug(slug: string): Promise<Session | null> {
    try {
      const q = query(collection(db, "sessions"), where("slug", "==", slug));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      // Rien n'empêche une session d'en reprendre le slug d'une autre (les
      // règles ne voient pas les autres documents) : le premier résultat
      // venu, dans l'ordre des identifiants, pouvait alors capter ses liens
      // de partage, ceux de la chaîne perpétuelle compris. Le lien reste à
      // la chaîne perpétuelle, sinon à la session la plus ancienne. C'est le
      // drapeau `perpetual` qui désigne la chaîne, réservé à l'admin par les
      // règles ; un identifiant, lui, se choisit à la création, et une copie
      // nommée comme le slug aurait pris le lien de n'importe quelle session.
      const sessions = querySnapshot.docs.map((d) => this.convertToSession(d));
      return (
        sessions.find((session) => session.perpetual === true) ??
        sessions.reduce((oldest, session) =>
          session.createdAt.getTime() < oldest.createdAt.getTime() ? session : oldest,
        )
      );
    } catch (error) {
      this.handleFirestoreError(error, "récupération de la session par slug");
    }
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Omit<Session, "id" | "createdAt">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, "sessions", sessionId);
      await updateDoc(docRef, updates);
      this.invalidateSessionsCache();
    } catch (error) {
      this.handleFirestoreError(error, "mise à jour de la session");
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const docRef = doc(db, "sessions", sessionId);
      await deleteDoc(docRef);
      this.invalidateSessionsCache();
    } catch (error) {
      this.handleFirestoreError(error, "suppression de la session");
    }
  }
}

export const firestoreService = new FirestoreService();
