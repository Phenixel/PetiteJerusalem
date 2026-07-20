import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor POC — emballe l'app Vue existante dans un shell natif iOS/Android.
 *
 * `webDir` pointe sur la sortie du build Vite (`npm run build`).
 * Aucune réécriture : on sert le même bundle web que le site.
 *
 * Astuce d'itération rapide : décommente le bloc `server` ci-dessous pour
 * charger l'app depuis le serveur de dev (`npm run dev`) sur ton réseau local,
 * au lieu de rebuilder + `cap copy` à chaque changement.
 *   server: { url: 'http://192.168.x.x:5173', cleartext: true },
 */
const config: CapacitorConfig = {
  appId: 'fr.petitejerusalem.app',
  appName: 'Petite Jérusalem',
  webDir: 'dist',
  plugins: {
    // Auth native Google/Apple : le plugin ne fait qu'obtenir les credentials
    // (skipNativeAuth), la connexion Firebase elle-même passe par le SDK JS de
    // la webview (signInWithCredential dans authService) — indispensable pour
    // le flux Apple sur iOS (rawNonce) et pour que l'état d'auth reste celui
    // de l'app web.
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com', 'apple.com'],
    },
    // iOS : affiche les notifications push même quand l'app est au premier
    // plan (sinon iOS les avale). L'équivalent Android est géré dans
    // pushService via @capacitor/local-notifications.
    FirebaseMessaging: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
