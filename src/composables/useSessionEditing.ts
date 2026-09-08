import { useI18n } from "vue-i18n";
import type { Session, TextStudy } from "../models/models";
import { sessionService } from "../services/sessionService";
import { analyticsService } from "../services/analyticsService";
import { useConfirm } from "./useConfirm";
import { useToast } from "./useToast";

/** Ce que la modale de modification renvoie. */
export interface SessionEditData {
  name: string;
  description: string;
  dateLimit: string;
  guestEmailRequired: boolean;
}

/**
 * Modifier et clore une chaîne, depuis n'importe quel écran qui le propose
 * (page de la chaîne, accueil du partage, page de gestion, backoffice).
 *
 * Pourquoi : chaque écran avait sa copie de la sauvegarde (quatre) et de la
 * clôture (deux), avec les mêmes événements, les mêmes toasts, et des
 * divergences qui s'installaient (le taux de complétion à la clôture comptait
 * les tirages expirés dans l'une, pas dans l'autre). Ici, une seule version ;
 * `source` sépare les écrans dans les statistiques. Les fonctions renvoient
 * vrai en cas de succès : c'est à l'écran de reporter le changement sur son
 * état local (voir `edited` et `ended`).
 */
export function useSessionEditing(source: string) {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const toast = useToast();

  async function saveSession(session: Session, data: SessionEditData): Promise<boolean> {
    try {
      await sessionService.updateSession(session.id, { ...data, slug: session.slug });
      // Pas d'intitulé ni de description dans les propriétés : ils portent
      // des noms de personnes.
      analyticsService.capture("session_updated", {
        session_id: session.id,
        text_type: session.type,
        guest_email_required: data.guestEmailRequired,
        deadline_changed:
          session.dateLimit instanceof Date
            ? new Date(data.dateLimit).getTime() !== session.dateLimit.getTime()
            : null,
        source,
      });
      toast.success(t("profile.sessionUpdatedSuccess"));
      return true;
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      analyticsService.capture("session_update_failed", {
        session_id: session.id,
        error_message: error instanceof Error ? error.message : String(error),
        source,
      });
      toast.errorFromException(error, t("profile.sessionUpdateError"));
      return false;
    }
  }

  /** La session telle qu'elle est après une sauvegarde réussie. */
  function edited(session: Session, data: SessionEditData): Session {
    return {
      ...session,
      name: data.name,
      description: data.description,
      dateLimit: new Date(data.dateLimit),
      guestEmailRequired: data.guestEmailRequired,
      updatedAt: new Date(),
    };
  }

  /**
   * Clôture, après confirmation. Renvoie faux si l'utilisateur renonce ou si
   * l'écriture échoue.
   */
  async function endSession(session: Session, textStudies?: TextStudy[]): Promise<boolean> {
    if (!(await confirm({ title: t("profile.endSessionConfirm"), danger: true }))) return false;

    try {
      await sessionService.endSession(session.id);
      // Sortie de cycle de vie d'une chaîne : `session_created` n'avait aucune
      // fin, ni aboutie ni abandonnée. Le taux de complétion au moment de la
      // clôture dit si la chaîne est allée au bout ou a été close faute de
      // participants. Les tirages expirés n'y comptent pas.
      const stats = sessionService.getSessionReservationStats(session, textStudies);
      analyticsService.capture("session_ended", {
        session_id: session.id,
        text_type: session.type,
        reservations_count: stats.reserved,
        completion_rate: stats.reserved > 0 ? Math.round((stats.read / stats.reserved) * 100) : 0,
        reservation_rate: stats.percentage,
        source,
      });
      toast.success(t("profile.sessionEndedSuccess"));
      return true;
    } catch (error) {
      console.error("Erreur lors de la fin de session:", error);
      analyticsService.capture("session_end_failed", {
        session_id: session.id,
        error_message: error instanceof Error ? error.message : String(error),
        source,
      });
      toast.errorFromException(error, t("profile.sessionEndError"));
      return false;
    }
  }

  /** La session telle qu'elle est une fois close. */
  function ended(session: Session): Session {
    return { ...session, isEnded: true, endedAt: new Date(), updatedAt: new Date() };
  }

  return { saveSession, edited, endSession, ended };
}
