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
  /** Latin (UI) font choice, see LATIN_FONT_OPTIONS in useFonts. */
  fontLatin: string;
  /** Hebrew (reading) font choice, see HEBREW_FONT_OPTIONS in useFonts. */
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
   * rappel d'avant-chkia, où l'heure fixe était le seul rappel, d'où le
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
   * d'avant-chkia est actif, voir coarsePlace dans zmanimService.
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
 * Le document `userPreferences` reste la source de vérité, le serveur a
 * toujours raison, mais sans copie sur l'appareil, la liste du jour n'existe
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

/**
 * Oublie la copie locale (déconnexion, suppression de compte). Le suivi coché
 * hors ligne et pas encore synchronisé part avec elle : il appartient au compte
 * qui s'en va, et le serveur reste seul dépositaire de ce qui a été lu.
 */
export function clearPreferencesCache(userId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(cacheKey(userId));
    localStorage.removeItem(pendingKey(userId));
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
 * serveur à la reconnexion, en écrasant ce qui a pu changer depuis un autre
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
 * Suivi de lecture coché hors connexion, en attente d'être envoyé au serveur.
 * Contrairement à la liste (que le serveur seul décide), une lecture marquée
 * lue ne se perd pas : elle est gardée ici et fusionnée au retour du réseau.
 */
const PENDING_PROGRESS_PREFIX = "pj-daily-progress-pending:";

function pendingKey(userId: string): string {
  return `${PENDING_PROGRESS_PREFIX}${userId}`;
}

function readPendingProgress(userId: string): DailyReadingProgress | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(pendingKey(userId));
    return raw ? (JSON.parse(raw) as DailyReadingProgress) : null;
  } catch {
    return null;
  }
}

function writePendingProgress(userId: string, progress: DailyReadingProgress): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(pendingKey(userId), JSON.stringify(progress));
  } catch {
    // Stockage plein : la coche reste affichée, mais ne survivra pas.
  }
}

function clearPendingProgress(userId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(pendingKey(userId));
  } catch {
    // Rien à nettoyer.
  }
}

function unique(values: Iterable<string | number> | undefined): number[] {
  return [...new Set([...(values ?? [])].map(Number))];
}

/** Chapitres lus par texte : union des deux côtés, texte par texte. */
function mergeSections(
  a: Record<string, number[]> = {},
  b: Record<string, number[]> = {},
): Record<string, number[]> {
  const merged: Record<string, number[]> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    merged[id] = [...new Set([...(a[id] ?? []), ...(b[id] ?? [])])].sort((x, y) => x - y);
  }
  return merged;
}

type ParashaProgress = NonNullable<DailyReadingProgress["parashaProgress"]>;

/** Chnei mikra : même semaine → lu d'un côté suffit ; sinon la semaine la plus récente. */
function mergeParashaProgress(
  a: ParashaProgress | undefined,
  b: ParashaProgress | undefined,
): ParashaProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.week === b.week) return { week: a.week, completed: a.completed || b.completed };
  return a.week > b.week ? a : b;
}

/**
 * Fusionne deux suivis de la lecture du jour, celui du serveur et celui coché
 * sur l'appareil pendant une coupure.
 *
 * Règle : **c'est le « lu » qui gagne**. Un même jour, les deux suivis
 * s'additionnent (lu d'un côté = lu). Décocher hors ligne quelque chose que le
 * serveur sait déjà lu ne tient donc pas au retour du réseau, personne ne
 * décoche, et perdre une lecture faite serait plus gênant.
 *
 * Jours différents (la coupure a passé minuit) : le suivi du jour le plus
 * récent l'emporte en bloc, la journée d'avant n'ayant plus lieu d'être. Le
 * chnei mikra, lui, vit à la semaine : il se fusionne à part.
 */
export function mergeDailyProgress(
  server: DailyReadingProgress | undefined,
  local: DailyReadingProgress | undefined,
): DailyReadingProgress {
  const parashaProgress = mergeParashaProgress(server?.parashaProgress, local?.parashaProgress);
  const withParasha = (progress: DailyReadingProgress): DailyReadingProgress => {
    const merged = { ...progress };
    // Le suivi hebdomadaire est fusionné à part : celui du bloc retenu ne doit
    // pas repasser devant.
    if (parashaProgress) merged.parashaProgress = parashaProgress;
    else delete merged.parashaProgress;
    return merged;
  };

  if (!server?.date) return withParasha(local ?? { date: "", completedIds: [] });
  if (!local?.date) return withParasha(server);
  if (server.date !== local.date) return withParasha(server.date > local.date ? server : local);

  return withParasha({
    date: server.date,
    completedIds: unique([...(server.completedIds ?? []), ...(local.completedIds ?? [])]),
    completedSections: mergeSections(server.completedSections, local.completedSections),
    completedOptions: [
      ...new Set([...(server.completedOptions ?? []), ...(local.completedOptions ?? [])]),
    ],
  });
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
    return this.getPreferencesOrThrow(userId).catch((error) => {
      console.error("Erreur lors de la récupération des préférences:", error);
      return { ...DEFAULT_PREFERENCES };
    });
  }

  /**
   * La copie locale, en lecture synchrone : ce qui dépend du compte (thème,
   * polices, tableau de bord) s'affiche avec elle dès le premier rendu,
   * pendant que getPreferences interroge le serveur, qui a toujours raison
   * et confirmera ou corrigera. Null quand le compte n'a jamais été lu sur
   * cet appareil : l'appelant attend alors le serveur, comme avant.
   */
  getCachedPreferences(userId: string): UserPreferences | null {
    return readCache(userId);
  }

  /**
   * Comme getPreferences, mais laisse l'erreur remonter : indispensable quand
   * l'appelant doit distinguer « profil vide » de « Firestore injoignable »
   * le widget de lecture, par exemple, ne doit pas écraser son dernier état
   * avec des préférences par défaut qui ne sont qu'un échec de lecture.
   */
  getPreferencesOrThrow(userId: string): Promise<UserPreferences> {
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
      // Le serveur a toujours raison sur la liste ; le suivi coché hors ligne,
      // lui, remonte (voir mergeDailyProgress : le « lu » gagne).
      await this.flushPendingProgress(userId, prefs);
      // Réponse du serveur (suivi fusionné compris) : elle remplace la copie locale.
      writeCache(userId, prefs);
      return prefs;
    } catch (error) {
      // Réseau capricieux (l'appareil se croit en ligne) : la dernière copie
      // connue vaut mieux que des préférences vides.
      const cached = readCache(userId);
      if (cached) return cached;
      // Ni serveur ni copie locale : l'erreur remonte, getPreferences retombe
      // sur les valeurs par défaut, getPreferencesOrThrow laisse l'appelant
      // décider (le widget garde alors son dernier état au lieu de l'écraser).
      throw error;
    }
  }

  /**
   * Renvoie au serveur le suivi coché pendant une coupure, fusionné avec le
   * sien. `prefs` est modifié sur place pour porter le suivi fusionné : c'est
   * lui que la page affichera, sans attendre une seconde lecture.
   */
  private async flushPendingProgress(userId: string, prefs: UserPreferences): Promise<void> {
    const pending = readPendingProgress(userId);
    if (!pending) return;
    const merged = mergeDailyProgress(prefs.dailyReadingProgress, pending);
    prefs.dailyReadingProgress = merged;
    try {
      const { sdk, db } = await firestore();
      await sdk.setDoc(
        sdk.doc(db, this.collectionName, userId),
        { dailyReadingProgress: merged },
        { mergeFields: ["dailyReadingProgress"] },
      );
      clearPendingProgress(userId);
    } catch (error) {
      // Le serveur n'a pas confirmé : le suivi reste en attente et repartira
      // au prochain passage. Rien n'est perdu, rien n'est affirmé à tort.
      console.warn("Suivi de lecture hors ligne pas encore synchronisé:", error);
    }
  }

  /**
   * Enregistre le suivi de la lecture du jour (« marquer comme lu »).
   *
   * Contrairement à la liste, il n'est pas bloqué hors connexion : la coche est
   * gardée sur l'appareil et fusionnée avec le serveur au retour du réseau, où
   * c'est toujours le « lu » qui l'emporte. Renvoie `"queued"` quand le serveur
   * n'a pas (encore) pu confirmer.
   */
  async saveDailyProgress(
    userId: string,
    progress: DailyReadingProgress,
  ): Promise<"saved" | "queued"> {
    const keepLocally = () => {
      writePendingProgress(userId, progress);
      writeCache(userId, {
        ...(readCache(userId) ?? DEFAULT_PREFERENCES),
        dailyReadingProgress: progress,
      });
      return "queued" as const;
    };

    if (isOffline()) return keepLocally();
    try {
      await this.savePreferences(userId, { dailyReadingProgress: progress });
      // Ce qui était en attente vient d'être englobé par cette écriture.
      clearPendingProgress(userId);
      return "saved";
    } catch {
      // Réseau perdu en cours de route : la lecture faite ne se perd pas.
      return keepLocally();
    }
  }

  async savePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    // Voir OfflineWriteError : sans connexion, l'écriture ne serait ni
    // confirmée ni perdue, juste en attente, et gagnerait contre le serveur
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
