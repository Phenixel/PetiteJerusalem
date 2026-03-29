import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";

export interface UserPreferences {
  theme: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "ocean",
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
