import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../firebase'
import type { TypeTextStudy, TextStudy, Session, TextStudyReservation } from '../models/models'

export class FirestoreService {
  // TypeTextStudy
  async createTypeTextStudy(type: Omit<TypeTextStudy, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'typeTextStudies'), {
      ...type,
      createdAt: Timestamp.now(),
    })
    return docRef.id
  }

  async getTypeTextStudyByName(name: string): Promise<TypeTextStudy | null> {
    const q = query(collection(db, 'typeTextStudies'), where('name', '==', name))
    const querySnapshot = await getDocs(q)
    if (querySnapshot.empty) return null

    const doc = querySnapshot.docs[0]
    return { id: doc.id, ...doc.data() } as TypeTextStudy
  }

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

  // Session
  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'isCompleted'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'sessions'), {
      ...session,
      createdAt: Timestamp.now(),
      isCompleted: false,
    })
    return docRef.id
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

  // Utilitaires
  async getOrCreateTypeTextStudy(name: string): Promise<string> {
    const existing = await this.getTypeTextStudyByName(name)
    if (existing) return existing.id

    return await this.createTypeTextStudy({ name })
  }
}
