import type { Bookmark, ReadingPosition } from "./readingProgressService";
import type { ReminderPlace } from "./zmanimService";

// Ce module est chargé dès le démarrage (useTheme et useFonts, montés par
// App.vue, ainsi que la home). Firestore y est donc importé DYNAMIQUEMENT :
// un import statique ramènerait tout le SDK (~600 kB minifiés) dans le bundle
// initial, ce que le découpage de src/firebase/ cherche justement à éviter.
async function firestore() {
  const [sdk, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../firebase/firestore"),
  ]);
  return { sdk, db };
}

/** Daily reading completion for a single day. Resets when the date changes. */
export interface DailyReadingProgress {
  /** Local calendar day (YYYY-MM-DD) the completions belong to. */
  date: string;
  /** Ids of the texts fully marked as read on that day. */
  completedIds: number[];
  /**
   * Chapitres lus par texte (id → index de sections), pour les textes qui se
   * lisent chapitre par chapitre. Un texte dont tous les chapitres sont lus
   * bascule aussi dans `completedIds`.
   */
  completedSections?: Record<string, number[]>;
  /** Lectures du moment quotidiennes (cycles Tehilim) marquées lues aujourd'hui. */
  completedOptions?: string[];
  /**
   * Suivi hebdomadaire du chnei mikra : `week` est la date du Chabbat de la
   * paracha (weekKey). Contrairement au reste, il ne se remet à zéro qu'au
   * changement de paracha.
   */
  parashaProgress?: { week: string; completed: boolean };
}

export interface UserPreferences {
  theme: string;
  /** Latin (UI) font choice — see LATIN_FONT_OPTIONS in useFonts. */
  fontLatin: string;
  /** Hebrew (reading) font choice — see HEBREW_FONT_OPTIONS in useFonts. */
  fontHebrew: string;
  /** Ordered ids of the texts the user reads every day (their daily reading list). */
  dailyReadingIds: number[];
  /** Lectures du moment activées (clés de dailyCycles : paracha, cycles Tehilim). */
  dailyReadingOptions: string[];
  /** Per-day read tracking for the daily reading list. */
  dailyReadingProgress: DailyReadingProgress;
  /** FCM tokens of the user's devices (native app), read by the reminder Cloud Function. */
  fcmTokens: string[];
  /** Interrupteur général des rappels de lecture (app native). */
  pushReminderEnabled: boolean;
  /**
   * Rappel à heure fixe. Indépendant du rappel d'avant-chkia : les deux vivent
   * sous `pushReminderEnabled`. Absent des profils antérieurs à l'ajout du
   * rappel d'avant-chkia, où l'heure fixe était le seul rappel — d'où le
   * défaut à vrai, ici comme dans la Cloud Function.
   */
  pushReminderDailyEnabled: boolean;
  /** Hour of day (0-23, Paris time) the reminder is sent at. */
  pushReminderHour: number;
  /** Minute of the hour (0-55, 5-minute steps) the reminder is sent at. */
  pushReminderMinute: number;
  /** Rappel « dernier appel » 20 minutes avant la chkia. */
  pushSunsetReminderEnabled: boolean;
  /**
   * Lieu (arrondi) du calcul de la chkia, écrit seulement quand le rappel
   * d'avant-chkia est actif — voir coarsePlace dans zmanimService.
   */
  pushReminderPlace: ReminderPlace | null;
  /** Locale the reminder notifications are sent in (fr/en/he). */
  pushLocale: string;
  /** Slugs des chiourim déjà ouverts par l'utilisateur (marqueur « Vu »). */
  viewedChiourim: string[];
  /** Dernière position de lecture par texte (reprise inter-appareils). */
  readingPositions: Record<string, ReadingPosition>;
  /** Marque-pages posés dans les textes de la bibliothèque. */
  bookmarks: Bookmark[];
  /**
   * Marque-pages supprimés (id → epoch ms de la suppression) : sans cette
   * trace, un appareil resté avec l'ancienne liste ré-ajouterait le
   * marque-page à la prochaine fusion.
   */
  deletedBookmarks: Record<string, number>;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "ocean",
  fontLatin: "inter",
  fontHebrew: "frank",
  dailyReadingIds: [],
  dailyReadingOptions: [],
  dailyReadingProgress: { date: "", completedIds: [] },
  fcmTokens: [],
  pushReminderEnabled: false,
  pushReminderDailyEnabled: true,
  pushReminderHour: 18,
  pushReminderMinute: 0,
  pushSunsetReminderEnabled: false,
  pushReminderPlace: null,
  pushLocale: "fr",
  viewedChiourim: [],
  readingPositions: {},
  bookmarks: [],
  deletedBookmarks: {},
};

/**
 * Copie locale des préférences (app native : lecture quotidienne hors ligne).
 *
 * Le document `userPreferences` reste la source de vérité — le serveur a
 * toujours raison — mais sans copie sur l'appareil, la liste du jour n'existe
 * plus dès que le réseau manque : la page repartirait des valeurs par défaut
 * (liste vide, thème d'origine). On garde donc le dernier document reçu tel
 * quel, par compte, et on le sert quand Firestore est injoignable. Il n'est
 * JAMAIS modifié hors connexion : toute écriture passe par le serveur, et
 * chaque lecture réussie le remplace.
 *
 * Le cache persistant de Firestore répondrait souvent aussi, mais il est un
 * effet de bord du SDK : cette copie-ci est explicite, immédiate (aucun aller-
 * retour à tenter avant d'abandonner) et lisible même si le document n'a
 * jamais transité par ce cache-là.
 */
const CACHE_PREFIX = "pj-preferences:";

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

function readCache(userId: string): UserPreferences | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) };
  } catch {
    return null;
  }
}

function writeCache(userId: string, preferences: UserPreferences): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(preferences));
  } catch {
    // Stockage plein ou indisponible : l'app fonctionne, mais en ligne seulement.
  }
}

/** Oublie la copie locale (déconnexion, suppression de compte). */
export function clearPreferencesCache(userId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch {
    // Rien à nettoyer.
  }
}

/** Appareil hors ligne (webview Capacitor comme navigateur). */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Écriture demandée sans connexion. Hors ligne, une écriture Firestore ne
 * remonte pas d'erreur : le cache persistant (voir firebase/firestore.ts)
 * l'applique localement et la garde en attente jusqu'au retour du réseau. Elle
 * laisserait donc l'interface bloquée sur « en cours », puis s'imposerait au
 * serveur à la reconnexion — en écrasant ce qui a pu changer depuis un autre
 * appareil. Le serveur ayant toujours raison, on refuse l'écriture tout de
 * suite, pour que l'appelant le dise à l'utilisateur.
 */
export class OfflineWriteError extends Error {
  readonly isOffline = true;
  constructor() {
    super("OFFLINE");
    this.name = "OfflineWriteError";
  }
}

export function isOfflineWriteError(error: unknown): boolean {
  return error instanceof OfflineWriteError;
}

/**
 * Progression de la lecture du jour : LA règle de comptage, partagée entre la
 * page Lecture quotidienne et le tableau de bord de l'accueil (et recopiée
 * dans functions/src/dailyReminder.ts, qui ne peut pas importer src/).
 * Le chnei mikra (« parasha ») est un suivi hebdomadaire : hors décompte.
 * Les complétions sont intersectées avec les listes actives : une entrée
 * obsolète (texte retiré, option désactivée) ne compte pas.
 */
export function countDailyProgress(input: {
  textIds: Array<string | number>;
  options: string[];
  completedTextIds: Iterable<string | number>;
  completedOptions: Iterable<string>;
}): { done: number; total: number } {
  const textIds = input.textIds.map(String);
  const options = input.options.filter((k) => k !== "parasha");
  const doneTexts = new Set([...input.completedTextIds].map(String));
  const doneOptions = new Set(input.completedOptions);
  return {
    total: textIds.length + options.length,
    done:
      textIds.filter((id) => doneTexts.has(id)).length +
      options.filter((k) => doneOptions.has(k)).length,
  };
}

class UserPreferencesService {
  private collectionName = "userPreferences";

  // Au démarrage d'une session connectée, useTheme, useFonts et la home
  // demandent chacun les préférences en même temps : on partage la requête en
  // vol au lieu de lire trois fois le même document. Pas de cache durable
  // (l'entrée est retirée dès la résolution) : aucune donnée périmée possible.
  private inflight = new Map<string, Promise<UserPreferences>>();

  getPreferences(userId: string): Promise<UserPreferences> {
    const pending = this.inflight.get(userId);
    if (pending) return pending;
    const request = this.fetchPreferences(userId).finally(() => this.inflight.delete(userId));
    this.inflight.set(userId, request);
    return request;
  }

  private async fetchPreferences(userId: string): Promise<UserPreferences> {
    // Hors ligne : la copie locale directement, sans attendre que Firestore
    // renonce. C'est ce qui rend la lecture quotidienne lisible sans réseau.
    if (isOffline()) {
      const cached = readCache(userId);
      if (cached) return cached;
    }
    try {
      const { sdk, db } = await firestore();
      const docRef = sdk.doc(db, this.collectionName, userId);
      const docSnap = await sdk.getDoc(docRef);

      const prefs = docSnap.exists()
        ? ({ ...DEFAULT_PREFERENCES, ...docSnap.data() } as UserPreferences)
        : { ...DEFAULT_PREFERENCES };
      // Le serveur a toujours raison : sa réponse remplace la copie locale.
      writeCache(userId, prefs);
      return prefs;
    } catch (error) {
      console.error("Erreur lors de la récupération des préférences:", error);
      // Réseau capricieux (l'appareil se croit en ligne) : la dernière copie
      // connue vaut mieux que des préférences vides.
      return readCache(userId) ?? { ...DEFAULT_PREFERENCES };
    }
  }

  async savePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    // Voir OfflineWriteError : sans connexion, l'écriture ne serait ni
    // confirmée ni perdue, juste en attente — et gagnerait contre le serveur
    // à la reconnexion. On la refuse.
    if (isOffline()) throw new OfflineWriteError();
    try {
      const { sdk, db } = await firestore();
      const docRef = sdk.doc(db, this.collectionName, userId);
      // mergeFields (et non merge:true) : chaque champ fourni REMPLACE sa
      // valeur. merge:true fusionnerait en profondeur les maps
      // (readingPositions, dailyReadingProgress.completedSections…) et une clé
      // retirée localement ne serait jamais supprimée du document.
      await sdk.setDoc(docRef, preferences, { mergeFields: Object.keys(preferences) });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des préférences:", error);
      throw new Error("Erreur lors de la sauvegarde des préférences.");
    }
    // Écriture confirmée par le serveur : la copie locale suit, pour que la
    // prochaine ouverture hors ligne montre bien la liste à jour.
    const cached = readCache(userId);
    if (cached) writeCache(userId, { ...cached, ...preferences });
  }

  /** Ajoute un chiour à la liste des « déjà vus » (idempotent via arrayUnion). */
  async markChiourViewed(userId: string, slug: string): Promise<void> {
    const { sdk, db } = await firestore();
    const docRef = sdk.doc(db, this.collectionName, userId);
    await sdk.setDoc(docRef, { viewedChiourim: sdk.arrayUnion(slug) }, { merge: true });
  }

  /** Supprime définitivement le document de préférences (suppression de compte). */
  async deletePreferences(userId: string): Promise<void> {
    const { sdk, db } = await firestore();
    const docRef = sdk.doc(db, this.collectionName, userId);
    await sdk.deleteDoc(docRef);
    clearPreferencesCache(userId);
  }
}

export const userPreferencesService = new UserPreferencesService();
