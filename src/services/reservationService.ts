import type { Session, TextStudy, TextStudyReservation, ReservationRecord } from '../models/models'
import { db } from '../../firebase'
import { doc, runTransaction } from 'firebase/firestore'

export interface ReservationForm {
  name: string
  email: string
}

export class ReservationService {
  // Créer une réservation (enregistrée dans le document de session)
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

        // éviter les doublons (même textStudyId + section)
        if (
          reservations.find((r) => r.textStudyId === textStudyId && r.section === section) !==
          undefined
        ) {
          throw new Error('Cette section est déjà réservée')
        }

        // Construire l'objet de réservation sans valeurs undefined
        const newReservation: ReservationRecord = {
          id: reservationId,
          textStudyId,
          chosenByName: userName || guestName || 'Utilisateur inconnu',
          available: false,
          isCompleted: false,
          createdAt: new Date().toISOString(),
        }

        // Ajouter section seulement si défini
        if (section !== undefined) {
          newReservation.section = section
        }

        // Ajouter chosenById seulement si défini
        if (userId) {
          newReservation.chosenById = userId
        }

        // Ajouter chosenByGuestId seulement si défini
        if (guestId) {
          newReservation.chosenByGuestId = guestId
        }

        reservations.push(newReservation)
        transaction.update(sfDocRef, { reservations })
      })
    })

    return reservationId
  }

  // Supprimer une réservation par id (intégrée dans le document de session)
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

  // Vérifier si un texte ou une section est réservé
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

  // Récupérer les réservations d'une session (depuis l'objet Session)
  getReservationsBySession(session: Session): TextStudyReservation[] {
    return session.reservations || []
  }

  // Obtenir le statut d'affichage d'un texte
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

    // Si tous les chapitres sont réservés par la même personne
    if (chapterReservations.length === textStudy.totalSections) {
      const firstReservation = chapterReservations[0]
      const allSamePerson = chapterReservations.every(
        (r) => r.chosenByName === firstReservation.chosenByName,
      )

      if (allSamePerson && firstReservation.chosenByName) {
        return { status: 'fully_reserved', reservedBy: firstReservation.chosenByName }
      }
    }

    // Si certains chapitres sont réservés mais pas tous
    if (chapterReservations.length > 0 && chapterReservations.length < textStudy.totalSections) {
      return { status: 'partially_reserved', reservedBy: null }
    }

    // Si tous les chapitres sont réservés par des personnes différentes
    if (chapterReservations.length === textStudy.totalSections) {
      const uniqueNames = [
        ...new Set(chapterReservations.map((r) => r.chosenByName).filter(Boolean)),
      ]
      return { status: 'fully_reserved', reservedBy: uniqueNames.join(', ') }
    }

    return { status: 'available', reservedBy: null }
  }

  // Vérifier si tous les chapitres d'un texte sont réservés par la même personne
  isTextFullyReservedBySamePerson(
    textStudyId: string,
    textStudy: TextStudy,
    session: Session,
  ): { isFullyReserved: boolean; reservedBy: string | null } {
    const reservations = this.getReservationsBySession(session)
    const textReservations = reservations.filter((r) => r.textStudyId === textStudyId)
    const chapterReservations = textReservations.filter((r) => r.section !== undefined)

    // Si aucun chapitre n'est réservé, le texte n'est pas réservé
    if (chapterReservations.length === 0) {
      return { isFullyReserved: false, reservedBy: null }
    }

    // Vérifier si tous les chapitres sont réservés
    const allChaptersReserved = chapterReservations.length === textStudy.totalSections

    if (!allChaptersReserved) {
      return { isFullyReserved: false, reservedBy: null }
    }

    // Vérifier si tous les chapitres sont réservés par la même personne
    const firstReservation = chapterReservations[0]
    const allSamePerson = chapterReservations.every(
      (r) => r.chosenByName === firstReservation.chosenByName,
    )

    return {
      isFullyReserved: true,
      reservedBy:
        allSamePerson && firstReservation.chosenByName ? firstReservation.chosenByName : null,
    }
  }

  // Créer une réservation pour un utilisateur connecté ou un invité
  async createReservationForUser(
    sessionId: string,
    textStudyId: string,
    section: number | undefined,
    currentUser: { id: string; name: string; email: string } | null,
    reservationForm: ReservationForm,
  ): Promise<string> {
    if (currentUser) {
      // Utilisateur connecté
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
      // Utilisateur invité
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

  // Créer une réservation locale pour l'interface
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
}
