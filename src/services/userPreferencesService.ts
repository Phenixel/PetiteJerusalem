import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

/** Daily reading completion for a single day. Resets when the date changes. */
export interface DailyReadingProgress {
  /** Local calendar day (YYYY-MM-DD) the completions belong to. */
  date: string;
  /** Ids of the texts marked as read on that day. */
  completedIds: number[];
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
  /** Locale the reminder notifications are sent in (fr/en/he). */
  pushLocale: string;
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
  pushLocale: "fr",
};

class UserPreferencesService {
  private collectionName = "userPreferences";

  async getPreferences(userId: string): Promise<UserPreferences> {
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

  /** Supprime définitivement le document de préférences (suppression de compte). */
  async deletePreferences(userId: string): Promise<void> {
    const docRef = doc(db, this.collectionName, userId);
    await deleteDoc(docRef);
  }
}

export const userPreferencesService = new UserPreferencesService();
