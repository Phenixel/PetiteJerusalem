const STORAGE_KEY = "pj_guest_id";

// Repli mémoire lorsque localStorage est indisponible (navigation privée,
// tests Node…) : l'identité tient alors le temps de la page, ce qui suffit
// pour réserver puis annuler dans la foulée.
let inMemoryGuestId: string | null = null;

/**
 * Identité locale des invités sans email : un UUID généré côté navigateur et
 * conservé en localStorage. Il sert de `chosenByGuestId` pour que l'invité
 * puisse annuler ses réservations et les rattacher à un compte créé plus tard
 * depuis le même navigateur. Contrairement à l'email, il n'est pas
 * récupérable depuis un autre appareil.
 */
export class GuestService {
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
}

export const guestService = new GuestService();
