import type { ReservationRecord } from "../models/models";

/**
 * Une entrée du tableau `reservations` qui a la forme d'une réservation. Les
 * règles Firestore ne contrôlent que la taille du tableau : n'importe qui peut
 * y ajouter `null`, un nombre ou un objet sans texte, et une seule entrée de
 * ce genre faisait planter, chez tout le monde, chaque écran qui parcourt les
 * réservations (`null.expiresAt`). Le client ne parcourt donc que celles-ci.
 */
export function isReservationShape(value: unknown): value is ReservationRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { textStudyId?: unknown }).textStudyId === "string"
  );
}
