import type { EnumTypeTextStudy } from "./typeTextStudy";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: Date; // Optional: Firebase auth users don't have createdAt
}

export interface TextStudy {
  id: string;
  name: string;
  type: EnumTypeTextStudy;
  livre: string;
  link: string;
  totalSections: number;
  createdAt: Date;
}

export interface Session {
  id: string;
  name: string;
  type: EnumTypeTextStudy;
  description: string;
  dateLimit: Date;
  createdAt: Date;
  personId: string;
  creatorName: string;
  slug?: string;
  reservations: TextStudyReservation[];
  /**
   * Close par son créateur. Les anciens documents portent aussi un
   * `isCompleted`, jamais passé à vrai par l'application : il n'est plus lu.
   */
  isEnded?: boolean;
  endedAt?: Date;
  updatedAt?: Date;
  selectedBooks?: string[];
  /**
   * Impose l'email aux invités qui réservent. Absent (sessions existantes)
   * ou false : les invités peuvent réserver avec leur nom seul.
   */
  guestEmailRequired?: boolean;
  /**
   * Modération : session masquée du public (admin ou automatiquement au 3e
   * signalement). Seuls le créateur (bandeau d'information) et le backoffice
   * la voient encore.
   */
  hidden?: boolean;
  hiddenAt?: Date;
  /** "reports" (masquage automatique) ou "admin" (décision manuelle). */
  hiddenReason?: "reports" | "admin";
  /** Signalements ouverts distincts, dénormalisé par la Cloud Function. */
  reportsCount?: number;

  // === CHAÎNE PERPÉTUELLE (voir docs/chaine-perpetuelle.md) ===
  // Une session ordinaire pour les versions de l'app qui ne connaissent pas
  // ces champs : elles l'affichent avec sa date limite lointaine et y
  // réservent comme ailleurs.

  /** Toujours ouverte : un tour fini, la Cloud Function la remet à zéro. */
  perpetual?: boolean;
  /** Places d'un tour (150 pour les Tehilim) : ce que la Cloud Function compte. */
  slotCount?: number;
  /** Le tour en cours, à partir de 1. */
  cycle?: number;
  /** Tours terminés depuis l'ouverture. */
  completedCycles?: number;
  /** Début du tour en cours. */
  cycleStartedAt?: Date;
  /** Début et fin du dernier tour terminé. */
  lastCycleStartedAt?: Date;
  lastCycleEndedAt?: Date;
  /** Lecteurs distincts du dernier tour terminé (comptes et invités). */
  lastCycleParticipants?: number;
}

// === NOMS DE LA CHAÎNE PERPÉTUELLE ===

/** « ben » ou « bat » devant le nom de la mère. */
export type PrayerNameGender = "male" | "female";

/** Ce pour quoi l'on prie : une guérison, ou l'élévation d'une âme. */
export type PrayerNameKind = "refoua" | "leilouy";

/**
 * Un nom pour lequel la chaîne perpétuelle lit, dans la sous-collection
 * `sessions/{id}/names`. Il appartient au compte qui l'a proposé (lui seul le
 * corrige, le prolonge ou le retire).
 *
 * Deux façons d'être lu :
 *  - sans date : jusqu'à `expiresAt` (30 jours, renouvelables) ;
 *  - un leilouy nichmat avec la date hébraïque du décès : chaque année, de la
 *    semaine qui précède l'anniversaire jusqu'au jour même, sans échéance
 *    (`expiresAt` vaut alors null).
 */
export interface PrayerName {
  id: string;
  ownerId: string;
  gender: PrayerNameGender;
  firstName: string;
  motherName: string;
  kind: PrayerNameKind;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  /** Jour hébraïque du décès (1 à 30), leilouy nichmat seulement. */
  deathDay?: number;
  /** Mois hebcal du décès ; Adar gardé en ADAR_I, comme les dates du calendrier. */
  deathMonth?: number;
}

// === MODÉRATION (exigence App Store 1.2) ===

export type ReportReason = "inappropriate" | "offensive" | "spam" | "other";

/** Document de la collection `reports` : un signalement de session. */
export interface ReportDoc {
  sessionId: string;
  /** Nom de la session au moment du signalement (affichage backoffice). */
  sessionName: string;
  reason: ReportReason;
  details: string;
  /** uid du signaleur connecté, sinon null. */
  reporterId: string | null;
  /** Identifiant invité local du signaleur non connecté, sinon null. */
  reporterGuestId: string | null;
  status: "open" | "resolved";
  createdAt?: Date;
}

export interface TextStudyReservation {
  id: string;
  chosenById?: string;
  chosenByGuestId?: string;
  chosenByName?: string;
  textStudyId: string;
  section?: number;
  isCompleted: boolean;
  createdAt: Date;
  /**
   * Date limite (ISO) au-delà de laquelle une réservation non lue est ignorée
   * et redevient prenable. Posée uniquement par le tirage aléatoire, repoussée
   * tant que le lecteur est sur la page, effacée dès qu'il marque sa lecture :
   * les réservations choisies à la main n'en portent jamais.
   */
  expiresAt?: string;
}

// Types dédiés aux adaptateurs / stockage (DTO)
export interface ReservationRecord {
  id: string;
  textStudyId: string;
  section?: number;
  chosenById?: string;
  chosenByGuestId?: string;
  chosenByName?: string;
  isCompleted: boolean;
  createdAt: string;
  /** Voir TextStudyReservation.expiresAt. */
  expiresAt?: string;
}

export interface TextStudyJsonEntry {
  id: number | string;
  name: string;
  livre: string;
  link: string;
  totalSections: number;
  type: string;
}

export interface TextStudiesJson {
  textStudies: TextStudyJsonEntry[];
  types: string[];
}

// === CHIOURIM ===

export interface Chiour {
  slug: string;
  name: string;
  description: string;
  auteur: string | null;
  categories: string[];
  mediaUrl: string;
  niveau: string | null;
  auteurId: string | null;
  serieId: string | null;
  episode: number | null;
}

/**
 * Forme du document stocké dans Firestore (collection `chiourim`).
 * `audioPath` est le chemin Cloud Storage ; `mediaUrl` l'URL de téléchargement
 * permanente résolue lors de la migration / de l'upload admin.
 */
export interface ChiourDoc {
  slug: string;
  name: string;
  description: string;
  auteur: string | null;
  categories: string[];
  niveau: string | null;
  audioPath: string;
  mediaUrl: string;
  duration?: number | null;
  fileSize?: number | null;
  published: boolean;
  /**
   * Nombre de vues (ouvertures de la page du chiour), incrémenté par les
   * clients publics sous contrôle des rules (+1 strict, chiour publié).
   */
  views?: number;
  // Backoffice : rattachement à un auteur (collection `auteurs`) et à une
  // série (collection `series`). `auteur` (string) reste la source affichée
  // par les apps mobiles déjà déployées, toujours dénormalisé depuis
  // `auteurs.name`, jamais supprimé.
  auteurId?: string | null;
  serieId?: string | null;
  episode?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Document de la collection `auteurs` (doc ID = slug). */
export interface AuteurDoc {
  name: string;
  slug: string;
  bio: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Document de la collection `series` (doc ID = `${auteurId}--${slug de la série}`). */
export interface SerieDoc {
  name: string;
  slug: string;
  auteurId: string;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Document de la collection `studioTokens` (doc ID = le token secret).
 * Le doc ID est le seul secret : il n'est jamais recopié dans un champ
 * lisible ailleurs (chiourim, storage public, etc.).
 */
export interface StudioTokenDoc {
  auteurId: string;
  auteurName: string;
  active: boolean;
  createdAt?: Date;
}
