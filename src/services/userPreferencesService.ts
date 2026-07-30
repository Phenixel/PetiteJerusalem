import { doc, getDoc, setDoc, deleteDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebase";
import type { Bookmark, ReadingPosition } from "./readingProgressService";

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
}

export interface UserPreferences {
  theme: string;
  /** Latin (UI) font choice — see LATIN_FONT_OPTIONS in useFonts. */
  fontLatin: string;
  /** Hebrew (reading) font choice — see HEBREW_FONT_OPTIONS in useFonts. */
  fontHebrew: string;
  /** Ordered ids of the texts the user reads every day (their daily reading list). */
  dailyReadingIds: number[];
  /** Per-day read tracking for the daily reading list. */
  dailyReadingProgress: DailyReadingProgress;
  /** FCM tokens of the user's devices (native app), read by the reminder Cloud Function. */
  fcmTokens: string[];
  /** Whether the daily reading push reminder is on (native app). */
  pushReminderEnabled: boolean;
  /** Hour of day (0-23, Paris time) the reminder is sent at. */
  pushReminderHour: number;
  /** Minute of the hour (0-55, 5-minute steps) the reminder is sent at. */
  pushReminderMinute: number;
  /** Locale the reminder notifications are sent in (fr/en/he). */
  pushLocale: string;
  /** Slugs des chiourim déjà ouverts par l'utilisateur (marqueur « Vu »). */
  viewedChiourim: string[];
  /** Dernière position de lecture par texte (reprise inter-appareils). */
  readingPositions: Record<string, ReadingPosition>;
  /** Marque-pages posés dans les textes de la bibliothèque. */
  bookmarks: Bookmark[];
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "ocean",
  fontLatin: "inter",
  fontHebrew: "frank",
  dailyReadingIds: [],
  dailyReadingProgress: { date: "", completedIds: [] },
  fcmTokens: [],
  pushReminderEnabled: false,
  pushReminderHour: 18,
  pushReminderMinute: 0,
  pushLocale: "fr",
  viewedChiourim: [],
  readingPositions: {},
  bookmarks: [],
};

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
    try {
      const docRef = doc(db, this.collectionName, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { ...DEFAULT_PREFERENCES, ...docSnap.data() } as UserPreferences;
      }
      return { ...DEFAULT_PREFERENCES };
    } catch (error) {
      console.error("Erreur lors de la récupération des préférences:", error);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  async savePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, userId);
      await setDoc(docRef, preferences, { merge: true });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des préférences:", error);
      throw new Error("Erreur lors de la sauvegarde des préférences.");
    }
  }

  /** Ajoute un chiour à la liste des « déjà vus » (idempotent via arrayUnion). */
  async markChiourViewed(userId: string, slug: string): Promise<void> {
    const docRef = doc(db, this.collectionName, userId);
    await setDoc(docRef, { viewedChiourim: arrayUnion(slug) }, { merge: true });
  }

  /** Supprime définitivement le document de préférences (suppression de compte). */
  async deletePreferences(userId: string): Promise<void> {
    const docRef = doc(db, this.collectionName, userId);
    await deleteDoc(docRef);
  }
}

export const userPreferencesService = new UserPreferencesService();
