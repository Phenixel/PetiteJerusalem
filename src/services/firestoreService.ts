import {
  collection,
  doc,
  addDoc,
  Timestamp,
  writeBatch,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../../firebase'
import type { TextStudy, Session, TextStudyReservation } from '../models/models'

export class FirestoreService {
  // === MÉTHODES UTILITAIRES ===

  private convertToTextStudy(doc: QueryDocumentSnapshot<DocumentData>): TextStudy {
    const data = doc.data()
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as TextStudy
  }

  private convertToSession(doc: QueryDocumentSnapshot<DocumentData>): Session {
    const data = doc.data()
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
      dateLimit: data.dateLimit?.toDate() || new Date(),
      endedAt: data.endedAt?.toDate() || undefined,
      updatedAt: data.updatedAt?.toDate() || undefined,
    } as Session
  }

  private convertToTextStudyReservation(
    doc: QueryDocumentSnapshot<DocumentData>,
  ): TextStudyReservation {
    const data = doc.data()
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as TextStudyReservation
  }

  private handleFirestoreError(error: unknown, operation: string): never {
    console.error(`Erreur Firestore lors de ${operation}:`, error)
    throw new Error(`Erreur lors de ${operation}. Veuillez réessayer.`)
  }
  // === MÉTHODES TEXTSTUDY ===

  async createTextStudy(textStudy: Omit<TextStudy, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'textStudies'), {
        ...textStudy,
        createdAt: Timestamp.now(),
      })
      return docRef.id
    } catch (error) {
      this.handleFirestoreError(error, "création du texte d'étude")
    }
  }

  async createTextStudyBatch(textStudies: Omit<TextStudy, 'id' | 'createdAt'>[]): Promise<void> {
    try {
      const batch = writeBatch(db)

      textStudies.forEach((textStudy) => {
        const docRef = doc(collection(db, 'textStudies'))
        batch.set(docRef, {
          ...textStudy,
          createdAt: Timestamp.now(),
        })
      })

      await batch.commit()
    } catch (error) {
      this.handleFirestoreError(error, "création en lot des textes d'étude")
    }
  }

  async getTextStudiesByType(type: string): Promise<TextStudy[]> {
    try {
      const q = query(collection(db, 'textStudies'), where('type', '==', type))
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map((doc) => this.convertToTextStudy(doc))
    } catch (error) {
      this.handleFirestoreError(error, "récupération des textes d'étude par type")
    }
  }

  // === MÉTHODES SESSION ===

  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'isCompleted'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        ...session,
        createdAt: Timestamp.now(),
        isCompleted: false,
      })
      return docRef.id
    } catch (error) {
      this.handleFirestoreError(error, 'création de la session')
    }
  }

  async getSessions(): Promise<Session[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'sessions'))
      return querySnapshot.docs.map((doc) => this.convertToSession(doc))
    } catch (error) {
      this.handleFirestoreError(error, 'récupération des sessions')
    }
  }

  async getAllSessions(): Promise<Session[]> {
    return this.getSessions()
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    try {
      const docRef = doc(db, 'sessions', sessionId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return this.convertToSession(docSnap)
      }
      return null
    } catch (error) {
      this.handleFirestoreError(error, 'récupération de la session par ID')
    }
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Omit<Session, 'id' | 'createdAt'>>,
  ): Promise<void> {
    try {
      const docRef = doc(db, 'sessions', sessionId)
      await updateDoc(docRef, updates)
    } catch (error) {
      this.handleFirestoreError(error, 'mise à jour de la session')
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const docRef = doc(db, 'sessions', sessionId)
      await deleteDoc(docRef)
    } catch (error) {
      this.handleFirestoreError(error, 'suppression de la session')
    }
  }

  // === MÉTHODES TEXTSTUDYRESERVATION ===

  async createTextStudyReservation(
    reservation: Omit<TextStudyReservation, 'id' | 'createdAt'>,
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'textStudyReservations'), {
        ...reservation,
        createdAt: Timestamp.now(),
      })
      return docRef.id
    } catch (error) {
      this.handleFirestoreError(error, 'création de la réservation')
    }
  }

  async getReservationsBySession(sessionId: string): Promise<TextStudyReservation[]> {
    try {
      const q = query(collection(db, 'textStudyReservations'), where('sessionId', '==', sessionId))
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map((doc) => this.convertToTextStudyReservation(doc))
    } catch (error) {
      this.handleFirestoreError(error, 'récupération des réservations par session')
    }
  }

  async deleteTextStudyReservation(reservationId: string): Promise<void> {
    try {
      const docRef = doc(db, 'textStudyReservations', reservationId)
      await deleteDoc(docRef)
    } catch (error) {
      this.handleFirestoreError(error, 'suppression de la réservation')
    }
  }

  // === MÉTHODES UTILITAIRES POUR LES RÉSERVATIONS ===

  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName))
      return !querySnapshot.empty
    } catch (error) {
      console.warn(`Impossible de vérifier l'existence de la collection ${collectionName}:`, error)
      return false
    }
  }

  async countDocuments(collectionName: string): Promise<number> {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName))
      return querySnapshot.size
    } catch (error) {
      this.handleFirestoreError(error, `comptage des documents dans ${collectionName}`)
    }
  }
}

export const firestoreService = new FirestoreService()
