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
import { db } from "../../firebase";
import type { Session } from "../models/models";

// Durée de vie du cache de la liste des sessions. Court : les réservations
// des autres participants doivent apparaître rapidement.
const SESSIONS_CACHE_TTL_MS = 60_000;

/**
 * Erreur levée par FirestoreService : conserve le code Firestore d'origine
 * ("permission-denied", "unavailable"…) pour que l'UI adapte son message.
 */
export class FirestoreOperationError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = "FirestoreOperationError";
    this.code = code;
  }
}

export class FirestoreService {
  private sessionsCache: { data: Session[]; fetchedAt: number } | null = null;
  private sessionsCachePromise: Promise<Session[]> | null = null;

  // === MÉTHODES UTILITAIRES ===

  private convertToSession(doc: QueryDocumentSnapshot<DocumentData>): Session {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
      dateLimit: data.dateLimit?.toDate() || new Date(),
      slug: data.slug || "",
      endedAt: data.endedAt?.toDate() || undefined,
      updatedAt: data.updatedAt?.toDate() || undefined,
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
  }

  // === MÉTHODES SESSION ===

  async createSession(session: Omit<Session, "id" | "createdAt" | "isCompleted">): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, "sessions"), {
        ...session,
        createdAt: Timestamp.now(),
        isCompleted: false,
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
    this.sessionsCachePromise = (async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "sessions"));
        const sessions = querySnapshot.docs.map((doc) => this.convertToSession(doc));
        this.sessionsCache = { data: sessions, fetchedAt: Date.now() };
        return sessions;
      } catch (error) {
        this.handleFirestoreError(error, "récupération des sessions");
      } finally {
        this.sessionsCachePromise = null;
      }
    })();
    return this.sessionsCachePromise;
  }

  async getPublicSessions(): Promise<Session[]> {
    try {
      const q = query(collection(db, "sessions"), where("isPrivate", "!=", true));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => this.convertToSession(doc));
    } catch (error) {
      this.handleFirestoreError(error, "récupération des sessions publiques");
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
      if (!querySnapshot.empty) {
        return this.convertToSession(querySnapshot.docs[0]);
      }
      return null;
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
