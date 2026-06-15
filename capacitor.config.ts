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
}

export default config
