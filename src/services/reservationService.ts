import type { Session, TextStudy, TextStudyReservation, ReservationRecord } from "../models/models";
import { db } from "../firebase/firestore";
import { doc, runTransaction } from "firebase/firestore";
import { firestoreService } from "./firestoreService";
import { guestService } from "./guestService";
import { analyticsService } from "./analyticsService";
import { moderationService } from "./moderationService";
import {
  AccountGuestRenameError,
  GuestEmailRequiredError,
  GuestNameRequiredError,
  ReservationGoneError,
  ReservationOwnerRequiredError,
  SessionMissingError,
  SlotTakenError,
} from "./appError";

// Les vues et les tests l'importent d'ici, avec le service qui la lève.
export { ReservationGoneError } from "./appError";

export interface ReservationForm {
  name: string;
  email: string;
}

/** Un emplacement réservable : un chapitre précis, ou le texte entier. */
export interface ReservationSlot {
  textStudyId: string;
  section?: number;
}

/** Ce qu'il faut d'une réservation pour savoir si elle tient encore. */
type Expirable = { expiresAt?: string; isCompleted: boolean };

export type TextDisplayStatus = {
  status: "available" | "fully_reserved" | "partially_reserved";
  reservedBy: string | null;
};

/**
 * Durée de vie d'une réservation issue du tirage aléatoire : non lue au bout
 * d'une heure, elle est considérée comme abandonnée et redevient prenable.
 * Le filet ne sert qu'aux départs qu'on ne voit pas venir (onglet fermé,
 * application tuée) : quitter la page libère le texte tout de suite, et rester
 * dessus repousse l'échéance (voir renewReservationExpiry).
 */
export const RANDOM_RESERVATION_TTL_MS = 60 * 60 * 1000;

class ReservationService {
  /**
   * Une réservation à durée limitée (tirage aléatoire) qui n'a pas été lue à
   * temps : elle est ignorée par tous les affichages et remplacée à la
   * prochaine réservation du même emplacement.
   */
  isReservationExpired(reservation: Expirable): boolean {
    return (
      reservation.expiresAt !== undefined &&
      !reservation.isCompleted &&
      new Date(reservation.expiresAt).getTime() < Date.now()
    );
  }

  /** Les réservations qui tiennent encore leur emplacement. */
  activeReservations<T extends Expirable>(reservations: readonly T[]): T[] {
    return reservations.filter((r) => !this.isReservationExpired(r));
  }

  /**
   * Une réservation « texte entier » (section absente) couvre chacune de ses
   * sections ; demander « le chapitre 3 est-il pris ? » doit dire oui. Et
   * réciproquement, un chapitre pris interdit le texte entier.
   */
  private conflictsWithSlot(
    reservation: ReservationSlot,
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
   * La réservation qui tient un emplacement : celle de la section demandée,
   * ou celle du texte entier qui la couvre. Les réservations expirées ne
   * comptent pas : un tirage abandonné peut rester dans le tableau (le
   * ménage est borné par les règles Firestore), et c'est lui que trouvait
   * l'ancien `find` par texte et section, si bien qu'annuler ou marquer
   * « lu » tombait sur une réservation morte plutôt que sur la sienne.
   */
  findActiveReservation<T extends ReservationSlot & Expirable>(
    reservations: readonly T[],
    textStudyId: string,
    section: number | undefined,
  ): T | undefined {
    return (
      reservations.find(
        (r) =>
          r.textStudyId === textStudyId && r.section === section && !this.isReservationExpired(r),
      ) ??
      reservations.find(
        (r) =>
          r.textStudyId === textStudyId && r.section === undefined && !this.isReservationExpired(r),
      )
    );
  }

  /**
   * Une réservation « texte entier » (section undefined) et des réservations
   * « par section » sont mutuellement exclusives pour un même texte. Les
   * réservations expirées ne comptent pas : l'appelant doit les retirer du
   * tableau qu'il écrit (voir pruneExpiredForSlots).
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
   * Retire les réservations expirées des emplacements qu'on s'apprête à
   * réserver. Uniquement ceux-là, et au plus `budget` d'entre elles : les
   * règles Firestore n'acceptent une écriture du tableau que s'il grandit,
   * garde sa taille, ou perd exactement un élément. Un ménage plus large
   * ferait refuser la réservation elle-même ; ce qui reste en trop est de
   * toute façon ignoré par tous les affichages, et partira à la prochaine
   * réservation de son emplacement.
   *
   * Sans budget (état local d'une vue), tout ce qui occupe les emplacements
   * part : la vue ne doit plus rien trouver de mort à ces places.
   */
  pruneExpiredForSlots<T extends ReservationSlot & Expirable>(
    reservations: readonly T[],
    slots: readonly ReservationSlot[],
    budget: number = Number.POSITIVE_INFINITY,
  ): T[] {
    let remaining = budget;
    return reservations.filter((r) => {
      const droppable =
        remaining > 0 &&
        this.isReservationExpired(r) &&
        slots.some((slot) => this.conflictsWithSlot(r, slot.textStudyId, slot.section));
      if (droppable) remaining--;
      return !droppable;
    });
  }

  private buildRecord(
    id: string,
    slot: ReservationSlot,
    identity: {
      userId?: string;
      guestId?: string;
      name?: string;
      expiresAt?: string;
    },
  ): ReservationRecord {
    const record: ReservationRecord = {
      id,
      textStudyId: slot.textStudyId,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    // Pas de nom de repli persisté : c'est l'affichage qui dit « quelqu'un »
    // dans la langue du lecteur. Firestore refuse `undefined` : chaque champ
    // optionnel n'est posé que s'il a une valeur.
    if (identity.name) record.chosenByName = identity.name;
    if (slot.section !== undefined) record.section = slot.section;
    if (identity.userId) record.chosenById = identity.userId;
    if (identity.guestId) record.chosenByGuestId = identity.guestId;
    if (identity.expiresAt !== undefined) record.expiresAt = identity.expiresAt;
    return record;
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
      throw new ReservationOwnerRequiredError();
    }

    // Modération App Store : le nom d'invité s'affiche publiquement sur la session.
    moderationService.assertClean(guestName);

    const reservationId = crypto.randomUUID();
    const sfDocRef = doc(db, "sessions", sessionId);

    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new SessionMissingError();
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const existing: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];

        if (this.findConflictingReservation(existing, textStudyId, section) !== undefined) {
          throw new SlotTakenError();
        }

        // Un tirage aléatoire abandonné sur cet emplacement cède sa place.
        const reservations = this.pruneExpiredForSlots(existing, [{ textStudyId, section }], 2);

        reservations.push(
          this.buildRecord(
            reservationId,
            { textStudyId, section },
            { userId, guestId, name: userName || guestName, expiresAt: options?.expiresAt },
          ),
        );
        transaction.update(sfDocRef, { reservations });
      });
    });

    firestoreService.invalidateSessionsCache();
    return reservationId;
  }

  async createBatchReservations(
    sessionId: string,
    items: ReservationSlot[],
    userId: string | undefined,
    guestId: string | undefined,
    userName: string | undefined,
    guestName: string | undefined,
  ): Promise<string[]> {
    if (!userId && !guestId) {
      throw new ReservationOwnerRequiredError();
    }

    // Modération App Store : le nom d'invité s'affiche publiquement sur la session.
    moderationService.assertClean(guestName);

    if (items.length === 0) return [];

    const reservationIds = items.map(() => crypto.randomUUID());
    const sfDocRef = doc(db, "sessions", sessionId);

    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new SessionMissingError();
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const existing: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];

        // Les emplacements demandés dont le tirage a expiré sont libérés.
        const reservations = this.pruneExpiredForSlots(existing, items, items.length + 1);

        const newReservations = items.map((item, index) => {
          if (
            this.findConflictingReservation(reservations, item.textStudyId, item.section) !==
            undefined
          ) {
            throw new SlotTakenError();
          }
          return this.buildRecord(reservationIds[index], item, {
            userId,
            guestId,
            name: userName || guestName,
          });
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
          throw new SessionMissingError();
        }
        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];
        const filtered = reservations.filter((r: ReservationRecord) => r.id !== reservationId);
        // Déjà partie (emplacement repris après expiration, ménage du
        // créateur) : les règles n'acceptent qu'une suppression qui retire
        // vraiment un élément, écrire ici ne ferait qu'une erreur de plus.
        if (filtered.length === reservations.length) return;
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
          throw new SessionMissingError();
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
      throw new GuestNameRequiredError();
    }
    moderationService.assertClean(trimmedName);

    const sfDocRef = doc(db, "sessions", sessionId);

    const renamedCount = await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new SessionMissingError();
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];

        const target = reservations.find((r) => r.id === reservationId);
        if (!target) {
          throw new ReservationGoneError();
        }
        if (target.chosenById) {
          throw new AccountGuestRenameError();
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

  /**
   * « Ma » réservation, pour les listes du tableau de bord : faite avec mon
   * compte, ou en invité depuis ce navigateur (par email ou par l'identité
   * locale) avant que je crée mon compte. Les deux copies de ce test
   * (accueil du partage, « Je participe ») ignoraient l'identité locale : les
   * réservations d'un invité sans email disparaissaient de ses chaînes dès
   * qu'il se connectait.
   */
  isOwnReservation(
    reservation: Pick<TextStudyReservation, "chosenById" | "chosenByGuestId">,
    user: { id: string; email: string } | null,
  ): boolean {
    if (user && reservation.chosenById === user.id) return true;
    if (!reservation.chosenByGuestId) return false;
    return this.getGuestIdentifiers(user?.email).includes(reservation.chosenByGuestId);
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
    const reservation = this.findActiveReservation(
      session.reservations || [],
      textStudyId,
      section,
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

  getTextDisplayStatus(
    textStudyId: string,
    textStudy: TextStudy,
    session: Session,
  ): TextDisplayStatus {
    const textReservations = (session.reservations || []).filter(
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

    // Toutes les sections prises, par une ou plusieurs personnes : le texte
    // est complet, et on nomme tout le monde. L'ancienne version ne
    // reconnaissait que le cas d'une seule personne et laissait un texte
    // complet à plusieurs mains ressortir « disponible ».
    const takenSections = new Set(chapterReservations.map((r) => r.section)).size;
    if (takenSections >= textStudy.totalSections) {
      const names = [...new Set(chapterReservations.map((r) => r.chosenByName).filter(Boolean))];
      return { status: "fully_reserved", reservedBy: names.length > 0 ? names.join(", ") : null };
    }

    return { status: "partially_reserved", reservedBy: null };
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
  assertGuestFormValid(reservationForm: ReservationForm, guestEmailRequired: boolean): void {
    if (!reservationForm.name.trim()) {
      throw guestEmailRequired ? new GuestEmailRequiredError() : new GuestNameRequiredError();
    }
    if (guestEmailRequired && !reservationForm.email.trim()) {
      throw new GuestEmailRequiredError();
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
          throw new SessionMissingError();
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];

        const reservationIndex = reservations.findIndex((r) => r.id === reservationId);
        if (reservationIndex === -1) {
          throw new ReservationGoneError();
        }

        const target = { ...reservations[reservationIndex], isCompleted };
        // Lue, la réservation devient définitive : son échéance n'a plus lieu
        // d'être. La garder rendrait le texte immédiatement prenable si le
        // lecteur se ravisait plus tard (« remettre en non lu » après l'heure).
        if (isCompleted) delete target.expiresAt;
        reservations[reservationIndex] = target;
        transaction.update(sfDocRef, { reservations });
      });
    });
    firestoreService.invalidateSessionsCache();
  }

  /**
   * Repousse l'échéance d'un tirage tant que son lecteur est là. Sans cela,
   * une lecture qui dure (un long Téhilim, une pause, un retour) verrait son
   * texte redevenir prenable sous ses yeux. La taille du tableau ne bouge pas :
   * les règles Firestore acceptent l'écriture comme un simple changement de
   * statut.
   *
   * @throws ReservationGoneError si l'emplacement a déjà été repris.
   */
  async renewReservationExpiry(
    sessionId: string,
    reservationId: string,
    expiresAt: string,
  ): Promise<void> {
    const sfDocRef = doc(db, "sessions", sessionId);
    await runTransaction(db, (transaction) => {
      return transaction.get(sfDocRef).then((sfDoc) => {
        if (!sfDoc.exists()) {
          throw new SessionMissingError();
        }

        const data = sfDoc.data() as { reservations?: ReservationRecord[] };
        const reservations: ReservationRecord[] = Array.isArray(data.reservations)
          ? data.reservations
          : [];

        const index = reservations.findIndex((r) => r.id === reservationId);
        if (index === -1) {
          throw new ReservationGoneError();
        }
        // Une réservation déjà lue n'a plus d'échéance : rien à repousser.
        if (reservations[index].isCompleted || reservations[index].expiresAt === undefined) return;

        reservations[index] = { ...reservations[index], expiresAt };
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
    const guestIds = new Set([userEmail, ...(localGuestId ? [localGuestId] : [])].filter(Boolean));
    if (guestIds.size === 0) return 0;
    const isOwnGuestReservation = (r: { chosenByGuestId?: string }) =>
      r.chosenByGuestId !== undefined && guestIds.has(r.chosenByGuestId);

    // Les sessions candidates viennent du cache partagé (celui de l'accueil et
    // du partage de lectures), pas d'une lecture complète de la collection à
    // chaque connexion, trois fois par page de connexion. La transaction relit
    // chaque candidate à jour avant d'écrire.
    const sessions = await firestoreService.getSessions();
    const candidates = sessions.filter((s) => (s.reservations ?? []).some(isOwnGuestReservation));

    for (const candidate of candidates) {
      const sfDocRef = doc(db, "sessions", candidate.id);

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
                isCompleted: r.isCompleted,
                createdAt: r.createdAt,
              };
              if (r.section !== undefined) {
                updated.section = r.section;
              }
              // Un tirage en cours garde son échéance : le compte reprend la
              // réservation telle quelle, sans la rendre définitive.
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
