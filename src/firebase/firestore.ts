// Firestore, isolé dans son propre module : c'est le plus gros morceau du SDK
// Firebase. Les services de données (chiourim, sessions, admin…) sont
// eux-mêmes chargés à la demande et peuvent l'importer statiquement ; les
// modules du bundle initial (userPreferencesService, chargé par useTheme et
// useFonts dès App.vue) doivent passer par un import dynamique
// `await import("../firebase/firestore")` pour ne pas ramener Firestore dans
// le chargement initial.
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { app } from "./core";

// Cache local persistant (IndexedDB) : le marquage « lu », les préférences et
// les sessions consultées restent disponibles hors ligne et se synchronisent
// au retour du réseau, indispensable pour l'app mobile, sans effet négatif
// sur le web.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// Port de l'émulateur : voir la note dans ./core.ts (plage 8470-8477).
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, "localhost", 8470);
}
