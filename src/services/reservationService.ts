import type { Session, TextStudy, TextStudyReservation, ReservationRecord } from "../models/models";
import { db } from "../../firebase";
import { doc, runTransaction, collection, getDocs } from "firebase/firestore";
import { firestoreService } from "./firestoreService";
import { guestService } from "./guestService";
import { analyticsService } from "./analyticsService";

export interface ReservationForm {
  name: string;
  email: string;
}

/**
 * Durée de vie d'une réservation issue du tirage aléatoire : non lue au bout
 * d'une heure, elle est considérée comme abandonnée et redevient prenable.
 */
export const RANDOM_RESERVATION_TTL_MS = 60 * 60 * 1000;

export class ReservationService {
  /**
   * Une réservation à durée limitée (tirage aléatoire) qui n'a pas été lue à
   * temps : elle est ignorée par tous les affichages et remplacée à la
   * prochaine réservation du même emplacement.
   */
  isReservationExpired(reservation: { expiresAt?: string; isCompleted: boolean }): boolean {
    return (
      reservation.expiresAt !== undefined &&
      !reservation.isCompleted &&
      new Date(reservation.expiresAt).getTime() < Date.now()
    );
  }

  private conflictsWithSlot(
    reservation: ReservationRecord,
    textStudyId: string,
    section: number | undefined,
  ): boolean {
    return (
      reservation.textStudyId === textStudyId &&
      (reservation.section === section ||
        reservation.section === undefined ||
        section === undefined)
    );
  }

  /**
   * Une réservation « texte entier » (section undefined) et des réservations
   * « par section » sont mutuellement exclusives pour un même texte. Les
   * réservations expirées ne comptent pas : l'appelant doit les retirer du
   * tableau qu'il écrit (voir dropExpiredForSlot).
   */
  private findConflictingReservation(
    reservations: ReservationRecord[],
    textStudyId: string,
    section: number | undefined,
  ): ReservationRecord | undefined {
    return reservations.find(
      (r) => this.conflictsWithSlot(r, textStudyId, section) && !this.isReservationExpired(r),
    );
  }

  /**
   * Retire les réservations expirées de l'emplacement qu'on s'apprête à
   * réserver. Uniquement celles de CET emplacement : les règles Firestore
   * bornent la variation de taille du tableau à une réservation près, un
   * grand ménage global pourrait dépasser la borne et être rejeté.
   */
  private dropExpiredForSlot(
    reservations: ReservationRecord[],
    textStudyId: string,
    section: number | undefined,
  ): ReservationRecord[] {
    return reservations.filter(
      (r) => !(this.conflictsWithSlot(r, textStudyId, section) && this.isReservationExpired(r)),
    );
  }

  async createReservation(
    sessionId: string,
    textStudyId: string,
    section: number | undefined,
    userId: string | undefined,
    guestId: string | undefined,
    userName: string | undefined,
    guestName: string | undefined,
    options?: { expiresAt?: string },
  ): Promise<string> {
    if (!userId && !guestId) {
      throw new Error("Une réservation doit être associée à un utilisateur ou un invité");
    }

    const reservationId = crypto.randomUUID();
    const sfDocRef = doc(db, "sessions", sessionId);

    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new Error("Document de session introuvable");
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const existing: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];

        if (this.findConflictingReservation(existing, textStudyId, section) !== undefined) {
          throw new Error("Cette section est déjà réservée");
        }

        // Un tirage aléatoire abandonné sur cet emplacement cède sa place.
        const reservations = this.dropExpiredForSlot(existing, textStudyId, section);

        const newReservation: ReservationRecord = {
          id: reservationId,
          textStudyId,
          chosenByName: userName || guestName || "Utilisateur inconnu",
          available: false,
          isCompleted: false,
          createdAt: new Date().toISOString(),
        };

        if (section !== undefined) {
          newReservation.section = section;
        }

        if (userId) {
          newReservation.chosenById = userId;
        }

        if (guestId) {
          newReservation.chosenByGuestId = guestId;
        }

        if (options?.expiresAt !== undefined) {
          newReservation.expiresAt = options.expiresAt;
        }

        reservations.push(newReservation);
        transaction.update(sfDocRef, { reservations });
      });
    });

    firestoreService.invalidateSessionsCache();
    return reservationId;
  }

  async createBatchReservations(
    sessionId: string,
    items: Array<{ textStudyId: string; section?: number }>,
    userId: string | undefined,
    guestId: string | undefined,
    userName: string | undefined,
    guestName: string | undefined,
  ): Promise<string[]> {
    if (!userId && !guestId) {
      throw new Error("Une réservation doit être associée à un utilisateur ou un invité");
    }

    if (items.length === 0) return [];

    const reservationIds = items.map(() => crypto.randomUUID());
    const sfDocRef = doc(db, "sessions", sessionId);

    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new Error("Document de session introuvable");
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const existing: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];

        // Les emplacements demandés dont la réservation a expiré sont libérés.
        const reservations = items.reduce(
          (kept, item) => this.dropExpiredForSlot(kept, item.textStudyId, item.section),
          existing,
        );

        const newReservations: ReservationRecord[] = items.map((item, index) => {
          if (
            this.findConflictingReservation(reservations, item.textStudyId, item.section) !==
            undefined
          ) {
            throw new Error(
              `La section ${item.section ?? "complète"} de ${item.textStudyId} est déjà réservée`,
            );
          }

          const newReservation: ReservationRecord = {
            id: reservationIds[index],
            textStudyId: item.textStudyId,
            chosenByName: userName || guestName || "Utilisateur inconnu",
            available: false,
            isCompleted: false,
            createdAt: new Date().toISOString(),
          };

          if (item.section !== undefined) {
            newReservation.section = item.section;
          }

          if (userId) {
            newReservation.chosenById = userId;
          }

          if (guestId) {
            newReservation.chosenByGuestId = guestId;
          }

          return newReservation;
        });

        reservations.push(...newReservations);
        transaction.update(sfDocRef, { reservations });
      });
    });

    firestoreService.invalidateSessionsCache();
    return reservationIds;
  }

  async deleteReservation(sessionId: string, reservationId: string): Promise<void> {
    const sfDocRef = doc(db, "sessions", sessionId);
    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new Error("Document de session introuvable");
        }
        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];
        const filtered = reservations.filter((r: ReservationRecord) => r.id !== reservationId);
        transaction.update(sfDocRef, { reservations: filtered });
      });
    });
    firestoreService.invalidateSessionsCache();
  }

  /**
   * Supprime plusieurs réservations en une seule transaction : la page de
   * gestion permet d'en cocher un lot, et les supprimer une par une laisserait
   * un état partiel si l'une d'elles échouait.
   */
  async deleteReservations(sessionId: string, reservationIds: string[]): Promise<void> {
    if (reservationIds.length === 0) return;

    const idsToRemove = new Set(reservationIds);
    const sfDocRef = doc(db, "sessions", sessionId);

    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new Error("Document de session introuvable");
        }
        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];
        const filtered = reservations.filter((r) => !idsToRemove.has(r.id));
        transaction.update(sfDocRef, { reservations: filtered });
      });
    });

    firestoreService.invalidateSessionsCache();
  }

  /**
   * Corrige le nom d'un invité inscrit par le créateur de la session. Un même
   * invité (identifié par `chosenByGuestId`) peut avoir réservé plusieurs
   * chapitres : on les renomme tous d'un coup, sinon la correction d'une faute
   * de frappe demanderait autant de modifications que de réservations.
   * Les réservations rattachées à un compte ne sont pas modifiables : leur nom
   * vient du profil de la personne.
   *
   * @returns le nombre de réservations renommées.
   */
  async renameGuest(sessionId: string, reservationId: string, newName: string): Promise<number> {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      throw new Error("Le nom de l'invité ne peut pas être vide");
    }

    const sfDocRef = doc(db, "sessions", sessionId);

    const renamedCount = await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new Error("Document de session introuvable");
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];

        const target = reservations.find((r) => r.id === reservationId);
        if (!target) {
          throw new Error("Réservation introuvable");
        }
        if (target.chosenById) {
          throw new Error("Le nom d'un participant inscrit ne peut pas être modifié");
        }

        // Sans `chosenByGuestId` (donnée héritée), seule la réservation ciblée
        // peut être rattachée à l'invité de façon fiable.
        const shouldRename = (r: ReservationRecord) =>
          target.chosenByGuestId
            ? !r.chosenById && r.chosenByGuestId === target.chosenByGuestId
            : r.id === reservationId;

        let count = 0;
        const updated = reservations.map((r) => {
          if (!shouldRename(r)) return r;
          count++;
          return { ...r, chosenByName: trimmedName };
        });

        if (count > 0) {
          transaction.update(sfDocRef, { reservations: updated });
        }
        return count;
      });
    });

    if (renamedCount > 0) {
      firestoreService.invalidateSessionsCache();
    }
    return renamedCount;
  }

  /**
   * L'identité invité du navigateur courant : l'email saisi dans le
   * formulaire (identifiant historique) et l'UUID local. L'un ou l'autre
   * peut correspondre au `chosenByGuestId` d'une réservation.
   */
  getGuestIdentifiers(guestEmail?: string): string[] {
    const ids: string[] = [];
    if (guestEmail?.trim()) ids.push(guestEmail.trim());
    const localId = guestService.getLocalGuestId();
    if (localId) ids.push(localId);
    return ids;
  }

  canUserDeleteReservation(
    reservation: TextStudyReservation,
    currentUser: { id: string; email: string } | null,
    guestEmail?: string,
  ): boolean {
    if (currentUser) {
      return reservation.chosenById === currentUser.id;
    }

    if (!reservation.chosenByGuestId) {
      return false;
    }

    return this.getGuestIdentifiers(guestEmail).includes(reservation.chosenByGuestId);
  }

  isTextOrSectionReserved(
    textStudyId: string,
    section: number | undefined,
    session: Session,
  ): { isReserved: boolean; reservedBy?: string } {
    const reservations = this.getReservationsBySession(session);
    // Une réservation « texte entier » (section absente) couvre chacune de
    // ses sections : demander « le chapitre 3 est-il pris ? » doit dire oui.
    // Les réservations expirées (tirage aléatoire abandonné) ne comptent pas.
    const reservation = reservations.find(
      (r) =>
        r.textStudyId === textStudyId &&
        (r.section === section || r.section === undefined) &&
        !this.isReservationExpired(r),
    );

    if (reservation) {
      return {
        isReserved: true,
        reservedBy:
          reservation.chosenByName || reservation.chosenById || reservation.chosenByGuestId,
      };
    }

    return { isReserved: false };
  }

  getReservationsBySession(session: Session): TextStudyReservation[] {
    return session.reservations || [];
  }

  getTextDisplayStatus(
    textStudyId: string,
    textStudy: TextStudy,
    session: Session,
  ): { status: "available" | "fully_reserved" | "partially_reserved"; reservedBy: string | null } {
    const reservations = this.getReservationsBySession(session);
    const textReservations = reservations.filter(
      (r) => r.textStudyId === textStudyId && !this.isReservationExpired(r),
    );

    // Réservation du texte entier (section undefined) : le texte est pris.
    const fullReservation = textReservations.find((r) => r.section === undefined);
    if (fullReservation) {
      return { status: "fully_reserved", reservedBy: fullReservation.chosenByName || null };
    }

    const chapterReservations = textReservations.filter((r) => r.section !== undefined);

    if (chapterReservations.length === 0) {
      return { status: "available", reservedBy: null };
    }

    if (chapterReservations.length === textStudy.totalSections) {
      const firstReservation = chapterReservations[0];
      const allSamePerson = chapterReservations.every(
        (r) => r.chosenByName === firstReservation.chosenByName,
      );

      if (allSamePerson && firstReservation.chosenByName) {
        return { status: "fully_reserved", reservedBy: firstReservation.chosenByName };
      }
    }

    if (chapterReservations.length > 0 && chapterReservations.length < textStudy.totalSections) {
      return { status: "partially_reserved", reservedBy: null };
    }

    if (chapterReservations.length === textStudy.totalSections) {
      const uniqueNames = [
        ...new Set(chapterReservations.map((r) => r.chosenByName).filter(Boolean)),
      ];
      return { status: "fully_reserved", reservedBy: uniqueNames.join(", ") };
    }

    return { status: "available", reservedBy: null };
  }

  /**
   * Identifiant d'une réservation invité : l'email s'il est fourni
   * (récupérable depuis n'importe quel appareil), sinon l'UUID local du
   * navigateur (créé à la volée).
   */
  resolveGuestId(reservationForm: ReservationForm): string {
    return reservationForm.email.trim() || guestService.getOrCreateLocalGuestId();
  }

  /** Valide le formulaire invité selon l'exigence d'email de la session. */
  private assertGuestFormValid(reservationForm: ReservationForm, guestEmailRequired: boolean) {
    if (!reservationForm.name || (guestEmailRequired && !reservationForm.email.trim())) {
      throw new Error(
        guestEmailRequired ? "Veuillez remplir votre nom et email" : "Veuillez remplir votre nom",
      );
    }
  }

  async createReservationForUser(
    sessionId: string,
    textStudyId: string,
    section: number | undefined,
    currentUser: { id: string; name: string; email: string } | null,
    reservationForm: ReservationForm,
    guestEmailRequired: boolean = false,
  ): Promise<string> {
    if (currentUser) {
      return this.createReservation(
        sessionId,
        textStudyId,
        section,
        currentUser.id,
        undefined,
        currentUser.name,
        undefined,
      );
    } else {
      this.assertGuestFormValid(reservationForm, guestEmailRequired);

      return this.createReservation(
        sessionId,
        textStudyId,
        section,
        undefined,
        this.resolveGuestId(reservationForm),
        undefined,
        reservationForm.name,
      );
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
      ...(!currentUser && { chosenByGuestId: this.resolveGuestId(reservationForm) }),
    };
  }

  async markReservationAsCompleted(
    sessionId: string,
    reservationId: string,
    isCompleted: boolean,
  ): Promise<void> {
    const sfDocRef = doc(db, "sessions", sessionId);
    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new Error("Document de session introuvable");
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];

        const reservationIndex = reservations.findIndex((r) => r.id === reservationId);
        if (reservationIndex === -1) {
          throw new Error("Réservation introuvable");
        }

        reservations[reservationIndex].isCompleted = isCompleted;
        transaction.update(sfDocRef, { reservations });
      });
    });
    firestoreService.invalidateSessionsCache();
  }

  async migrateGuestReservations(
    userEmail: string,
    userId: string,
    userName: string,
    localGuestId?: string | null,
  ): Promise<number> {
    let migratedCount = 0;

    // Réservations faites avec l'email OU avec l'identité locale du
    // navigateur (invités sans email) : les deux sont rattachées au compte.
    const guestIds = new Set([userEmail, ...(localGuestId ? [localGuestId] : [])]);
    const isOwnGuestReservation = (r: ReservationRecord) =>
      r.chosenByGuestId !== undefined && guestIds.has(r.chosenByGuestId);

    const sessionsSnapshot = await getDocs(collection(db, "sessions"));

    for (const sessionDoc of sessionsSnapshot.docs) {
      const data = sessionDoc.data() as { reservations?: ReservationRecord[] };
      const reservations = Array.isArray(data.reservations) ? data.reservations : [];

      const hasGuestReservations = reservations.some(isOwnGuestReservation);

      if (!hasGuestReservations) continue;

      const sfDocRef = doc(db, "sessions", sessionDoc.id);

      // Le compteur est retourné par la transaction (le callback peut être
      // rejoué en cas de contention : ne jamais accumuler à l'intérieur).
      const sessionMigrated = await runTransaction(db, (transaction) => {
        return transaction.get(sfDocRef).then((sfDoc) => {
          if (!sfDoc.exists()) return 0;

          const freshData = sfDoc.data() as { reservations?: ReservationRecord[] };
          const freshReservations = Array.isArray(freshData.reservations)
            ? freshData.reservations
            : [];

          let count = 0;
          const updatedReservations = freshReservations.map((r) => {
            if (isOwnGuestReservation(r)) {
              count++;
              const updated: ReservationRecord = {
                id: r.id,
                textStudyId: r.textStudyId,
                chosenByName: userName,
                chosenById: userId,
                available: r.available,
                isCompleted: r.isCompleted,
                createdAt: r.createdAt,
              };
              if (r.section !== undefined) {
                updated.section = r.section;
              }
              if (r.expiresAt !== undefined) {
                updated.expiresAt = r.expiresAt;
              }
              return updated;
            }
            return r;
          });

          if (count > 0) {
            transaction.update(sfDocRef, { reservations: updatedReservations });
          }
          return count;
        });
      });

      migratedCount += sessionMigrated;
    }

    if (migratedCount > 0) {
      firestoreService.invalidateSessionsCache();
      // Preuve chiffrée du funnel « invité qui réserve → compte » : des
      // réservations invité viennent d'être rattachées à un compte.
      analyticsService.capture("guest_reservations_migrated", { migrated_count: migratedCount });
    }
    return migratedCount;
  }
}

export const reservationService = new ReservationService();
