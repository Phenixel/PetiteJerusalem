import { doc, getDoc, setDoc } from "firebase/firestore";
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
  /** Ordered ids of the texts the user reads every day (their daily reading list). */
  dailyReadingIds: number[];
  /** Per-day read tracking for the daily reading list. */
  dailyReadingProgress: DailyReadingProgress;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "ocean",
  dailyReadingIds: [],
  dailyReadingProgress: { date: "", completedIds: [] },
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
}

export const userPreferencesService = new UserPreferencesService();
