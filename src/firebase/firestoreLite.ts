// Firestore Lite : lectures ponctuelles en REST, sans cache local, sans canal
// d'écoute et sans IndexedDB (environ 33 kB gzip, contre 173 kB pour le SDK
// complet). Sert au site pour ce qu'un visiteur lit sans compte, les
// informations de l'équipe sur l'accueil : le SDK complet, chargé pour elles
// seules, ouvrait en plus un canal d'écoute et revenait sur IndexedDB toutes
// les quatre secondes tant que l'onglet restait ouvert. L'app native garde le
// SDK complet et son cache hors ligne (voir ./firestore).
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore/lite";
import { app } from "./core";

export const liteDb = getFirestore(app);

// Port de l'émulateur : voir la note dans ./core.ts (plage 8470-8477).
if (import.meta.env.DEV) {
  connectFirestoreEmulator(liteDb, "localhost", 8470);
}
