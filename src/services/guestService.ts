const STORAGE_KEY = "pj_guest_id";
/** Emails saisis par l'invité sur cet appareil, voir rememberGuestEmail. */
const EMAILS_KEY = "pj_guest_emails";
/** Au-delà, les plus anciens s'oublient : la liste ne grossit pas sans fin. */
const MAX_GUEST_EMAILS = 5;

// Repli mémoire lorsque localStorage est indisponible (navigation privée,
// tests Node…) : l'identité tient alors le temps de la page, ce qui suffit
// pour réserver puis annuler dans la foulée.
let inMemoryGuestId: string | null = null;
let inMemoryEmails: string[] = [];

/**
 * Identité locale des invités sans email : un UUID généré côté navigateur et
 * conservé en localStorage. Il sert de `chosenByGuestId` pour que l'invité
 * puisse annuler ses réservations et les rattacher à un compte créé plus tard
 * depuis le même navigateur. Contrairement à l'email, il n'est pas
 * récupérable depuis un autre appareil.
 */
class GuestService {
  /** Renvoie l'identifiant local s'il existe, sans jamais en créer. */
  getLocalGuestId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY) || inMemoryGuestId;
    } catch {
      return inMemoryGuestId;
    }
  }

  /** Renvoie l'identifiant local, en le créant et le persistant au besoin. */
  getOrCreateLocalGuestId(): string {
    const existing = this.getLocalGuestId();
    if (existing) return existing;

    const id = `guest-${crypto.randomUUID()}`;
    inMemoryGuestId = id;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage indisponible : l'identité restera en mémoire seulement.
    }
    return id;
  }

  /**
   * Les emails avec lesquels l'invité a réservé depuis cet appareil. Un
   * email saisi devient le `chosenByGuestId` de la réservation, mais le
   * formulaire se vide au rechargement : sans cette mémoire, l'invité ne
   * pouvait plus ni annuler ni marquer lue sa propre réservation.
   */
  getGuestEmails(): string[] {
    try {
      const raw = localStorage.getItem(EMAILS_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((e): e is string => typeof e === "string" && e !== "")
        : [];
    } catch {
      return inMemoryEmails;
    }
  }

  /** Retient l'email d'une réservation d'invité (le plus récent en tête). */
  rememberGuestEmail(email: string): void {
    const trimmed = email.trim();
    if (!trimmed) return;
    const emails = [trimmed, ...this.getGuestEmails().filter((e) => e !== trimmed)].slice(
      0,
      MAX_GUEST_EMAILS,
    );
    inMemoryEmails = emails;
    try {
      localStorage.setItem(EMAILS_KEY, JSON.stringify(emails));
    } catch {
      // localStorage indisponible : la mémoire tient le temps de la page.
    }
  }
}

export const guestService = new GuestService();
