import type { Session, TextStudy, TextStudyReservation, ReservationRecord } from '../models/models'
import { db } from '../../firebase'
import { doc, runTransaction } from 'firebase/firestore'

export interface ReservationForm {
  name: string
  email: string
}

export class ReservationService {
  async createReservation(
    sessionId: string,
    textStudyId: string,
    section: number | undefined,
    userId: string | undefined,
    guestId: string | undefined,
    userName: string | undefined,
    guestName: string | undefined,
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

        if (
          reservations.find((r) => r.textStudyId === textStudyId && r.section === section) !==
          undefined
        ) {
          throw new Error('Cette section est déjà réservée')
        }

        const newReservation: ReservationRecord = {
          id: reservationId,
          textStudyId,
          chosenByName: userName || guestName || 'Utilisateur inconnu',
          available: false,
          isCompleted: false,
          createdAt: new Date().toISOString(),
        }

        if (section !== undefined) {
          newReservation.section = section
        }

        if (userId) {
          newReservation.chosenById = userId
        }

        if (guestId) {
          newReservation.chosenByGuestId = guestId
        }

        reservations.push(newReservation)
        transaction.update(sfDocRef, { reservations })
      })
    })

    return reservationId
  }

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

  canUserDeleteReservation(
    reservation: TextStudyReservation,
    currentUser: { id: string; email: string } | null,
    guestEmail?: string,
  ): boolean {
    if (!currentUser && !guestEmail) {
      return false
    }

    if (currentUser && reservation.chosenById === currentUser.id) {
      return true
    }

    if (guestEmail && reservation.chosenByGuestId === guestEmail) {
      return true
    }

    return false
  }

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

  getReservationsBySession(session: Session): TextStudyReservation[] {
    return session.reservations || []
  }

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

    if (chapterReservations.length === textStudy.totalSections) {
      const firstReservation = chapterReservations[0]
      const allSamePerson = chapterReservations.every(
        (r) => r.chosenByName === firstReservation.chosenByName,
      )

      if (allSamePerson && firstReservation.chosenByName) {
        return { status: 'fully_reserved', reservedBy: firstReservation.chosenByName }
      }
    }

    if (chapterReservations.length > 0 && chapterReservations.length < textStudy.totalSections) {
      return { status: 'partially_reserved', reservedBy: null }
    }

    if (chapterReservations.length === textStudy.totalSections) {
      const uniqueNames = [
        ...new Set(chapterReservations.map((r) => r.chosenByName).filter(Boolean)),
      ]
      return { status: 'fully_reserved', reservedBy: uniqueNames.join(', ') }
    }

    return { status: 'available', reservedBy: null }
  }

  async createReservationForUser(
    sessionId: string,
    textStudyId: string,
    section: number | undefined,
    currentUser: { id: string; name: string; email: string } | null,
    reservationForm: ReservationForm,
  ): Promise<string> {
    if (currentUser) {
      return await this.createReservation(
        sessionId,
        textStudyId,
        section,
        currentUser.id,
        undefined,
        currentUser.name,
        undefined,
      )
    } else {
      if (!reservationForm.name || !reservationForm.email) {
        throw new Error('Veuillez remplir votre nom et email')
      }

      return await this.createReservation(
        sessionId,
        textStudyId,
        section,
        undefined,
        reservationForm.email,
        undefined,
        reservationForm.name,
      )
    }
  }

  createLocalReservation(
    reservationId: string,
    textStudyId: string,
    section: number | undefined,
    currentUser: { id: string; name: string; email: string } | null,
    reservationForm: ReservationForm,
  ): TextStudyReservation {
    return {
      id: reservationId,
      textStudyId,
      section,
      chosenByName: currentUser?.name || reservationForm.name,
      available: false,
      isCompleted: false,
      createdAt: new Date(),
      ...(currentUser?.id && { chosenById: currentUser.id }),
      ...(!currentUser && reservationForm.email && { chosenByGuestId: reservationForm.email }),
    }
  }

  async markReservationAsCompleted(
    sessionId: string,
    reservationId: string,
    isCompleted: boolean,
  ): Promise<void> {
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

        const reservationIndex = reservations.findIndex((r) => r.id === reservationId)
        if (reservationIndex === -1) {
          throw new Error('Réservation introuvable')
        }

        reservations[reservationIndex].isCompleted = isCompleted
        transaction.update(sfDocRef, { reservations })
      })
    })
  }
}

export const reservationService = new ReservationService()
