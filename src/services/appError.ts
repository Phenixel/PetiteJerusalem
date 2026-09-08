/**
 * Erreurs métier des services de session et de réservation.
 *
 * Chaque erreur porte un `code`, qui est la clé de son message traduit
 * (`errors.<code>` dans les locales) : les vues n'affichent jamais `message`,
 * qui reste un libellé technique en français pour les journaux et les tests.
 * Avant cela, les vues montraient `err.message` tel quel, en français quelle
 * que soit la langue, et parfois avec un identifiant interne (« La section 5
 * de 1274 est déjà réservée »). useToast.errorFromException fait la
 * traduction.
 */
export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

/** L'emplacement demandé est déjà tenu par une réservation valide. */
export class SlotTakenError extends AppError {
  constructor() {
    super("slotTaken", "Cette section est déjà réservée");
    this.name = "SlotTakenError";
  }
}

/** Formulaire invité sans nom. */
export class GuestNameRequiredError extends AppError {
  constructor() {
    super("guestNameRequired", "Veuillez remplir votre nom");
    this.name = "GuestNameRequiredError";
  }
}

/** Formulaire invité sans email, sur une chaîne qui l'exige. */
export class GuestEmailRequiredError extends AppError {
  constructor() {
    super("guestEmailRequired", "Veuillez remplir votre nom et email");
    this.name = "GuestEmailRequiredError";
  }
}

/** Le document de la session n'existe pas (ou plus). */
export class SessionMissingError extends AppError {
  constructor() {
    super("sessionMissing", "Document de session introuvable");
    this.name = "SessionMissingError";
  }
}

/**
 * La réservation visée n'existe plus dans le document : quelqu'un d'autre a
 * repris l'emplacement après l'expiration du tirage, ou le créateur de la
 * chaîne a fait le ménage. L'appelant doit retirer la réservation de son état
 * local et le dire au lecteur plutôt que d'afficher une erreur technique.
 */
export class ReservationGoneError extends AppError {
  constructor() {
    super("reservationGone", "Réservation introuvable");
    this.name = "ReservationGoneError";
  }
}

/** Une réservation sans compte ni identité invitée : un bug d'appelant. */
export class ReservationOwnerRequiredError extends AppError {
  constructor() {
    super(
      "reservationOwnerRequired",
      "Une réservation doit être associée à un utilisateur ou un invité",
    );
    this.name = "ReservationOwnerRequiredError";
  }
}

/** Le nom d'un compte vient de son profil, pas de la page de gestion. */
export class AccountGuestRenameError extends AppError {
  constructor() {
    super("accountGuestRename", "Le nom d'un participant inscrit ne peut pas être modifié");
    this.name = "AccountGuestRenameError";
  }
}

/** Création de chaîne avec un champ obligatoire vide. */
export class SessionFieldsRequiredError extends AppError {
  constructor() {
    super("sessionFieldsRequired", "Tous les champs sont obligatoires");
    this.name = "SessionFieldsRequiredError";
  }
}
