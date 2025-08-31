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
} from 'firebase/firestore'
import { db } from '../../firebase'
import type { TextStudy, Session, TextStudyReservation } from '../models/models'

export class FirestoreService {
  // TextStudy
  async createTextStudy(textStudy: Omit<TextStudy, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'textStudies'), {
      ...textStudy,
      createdAt: Timestamp.now(),
    })
    return docRef.id
  }

  async createTextStudyBatch(textStudies: Omit<TextStudy, 'id' | 'createdAt'>[]): Promise<void> {
    const batch = writeBatch(db)

    textStudies.forEach((textStudy) => {
      const docRef = doc(collection(db, 'textStudies'))
      batch.set(docRef, {
        ...textStudy,
        createdAt: Timestamp.now(),
      })
    })

    await batch.commit()
  }

  async getTextStudiesByType(type: string): Promise<TextStudy[]> {
    const q = query(collection(db, 'textStudies'), where('type', '==', type))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(
      (doc) =>
        ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        }) as TextStudy,
    )
  }

  // Session
  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'isCompleted'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'sessions'), {
      ...session,
      createdAt: Timestamp.now(),
      isCompleted: false,
    })
    return docRef.id
  }

  async getSessions(): Promise<Session[]> {
    const querySnapshot = await getDocs(collection(db, 'sessions'))
    return querySnapshot.docs.map(
      (doc) =>
        ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          dateLimit: doc.data().dateLimit?.toDate() || new Date(),
        }) as Session,
    )
  }

  async getAllSessions(): Promise<Session[]> {
    return this.getSessions()
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    const docRef = doc(db, 'sessions', sessionId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt?.toDate() || new Date(),
        dateLimit: data.dateLimit?.toDate() || new Date(),
      } as Session
    }
    return null
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Omit<Session, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const docRef = doc(db, 'sessions', sessionId)
    await updateDoc(docRef, updates)
  }

  async deleteSession(sessionId: string): Promise<void> {
    const docRef = doc(db, 'sessions', sessionId)
    await deleteDoc(docRef)
  }

  // TextStudyReservation
  async createTextStudyReservation(
    reservation: Omit<TextStudyReservation, 'id' | 'createdAt'>,
  ): Promise<string> {
    const docRef = await addDoc(collection(db, 'textStudyReservations'), {
      ...reservation,
      createdAt: Timestamp.now(),
    })
    return docRef.id
  }

  async getReservationsBySession(sessionId: string): Promise<TextStudyReservation[]> {
    const q = query(collection(db, 'textStudyReservations'), where('sessionId', '==', sessionId))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(
      (doc) =>
        ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        }) as TextStudyReservation,
    )
  }

  async deleteTextStudyReservation(reservationId: string): Promise<void> {
    const docRef = doc(db, 'textStudyReservations', reservationId)
    await deleteDoc(docRef)
  }
}
