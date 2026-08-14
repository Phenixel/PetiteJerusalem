// Initialisation Firebase minimale, embarquée dans le bundle initial : app +
// auth uniquement (la navbar, App.vue et la garde du routeur ont besoin de
// l'état de connexion dès le premier rendu). Firestore, Storage et Functions
// vivent dans leurs modules dédiés (./firestore, ./storage, ./functions) pour
// que leur poids — Firestore surtout, ~600 kB minifiés — ne pèse pas sur le
// chargement initial du site : ils ne sont tirés que par les écrans qui s'en
// servent. Un module du bundle initial ne doit JAMAIS les importer
// statiquement (voir userPreferencesService pour le motif d'import dynamique).
import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  connectAuthEmulator,
} from "firebase/auth";
import { isNativeApp } from "../composables/useNativeApp";

// Configuration publique du projet (les clés Web Firebase ne sont pas des
// secrets : la sécurité repose sur les règles Firestore/Storage).
const firebaseConfig = {
  apiKey: "AIzaSyCykY9IonqmVpuA0VGICXnMWVtVNWlipnk",
  authDomain: "petite-jerusalem.fr",
  projectId: "petite-jerusalem-dev",
  storageBucket: "petite-jerusalem-dev.firebasestorage.app",
  messagingSenderId: "152837353533",
  appId: "1:152837353533:web:f98a0d34a8c2e834d07a54",
  measurementId: "G-YCXXL5PMK0",
};

export const app = initializeApp(firebaseConfig);

// Dans l'app native, PAS de getAuth() : il embarque browserPopupRedirectResolver,
// qui charge une iframe depuis authDomain. Dans la WKWebView iOS (origine
// capacitor://localhost) cette iframe échoue silencieusement et l'initialisation
// d'Auth ne se termine jamais — et comme Firestore attend le premier jeton
// d'Auth, TOUTES les lectures Firestore pendent (écrans figés sur leurs
// squelettes). La connexion native passe par @capacitor-firebase/authentication
// puis signInWithCredential : le resolver popup/redirect est inutile sur natif.
// C'est la configuration recommandée par @capacitor-firebase/authentication.
export const auth = isNativeApp
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: "select_account",
});

// Émulateurs en développement. Plage de ports dédiée à ce projet (8470-8477)
// pour ne pas entrer en conflit avec d'autres projets Firebase tournant en
// parallèle. À garder en phase avec le bloc "emulators" de firebase.json.
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://localhost:8471", { disableWarnings: true });
}

// La mesure d'audience est assurée par PostHog (src/services/analyticsService),
// soumise au consentement (bannière ConsentBanner). Firebase/Google Analytics
// a été retiré : il faisait doublon et partait sans consentement.
