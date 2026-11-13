/**
 * Les deux environnements de Petite Jérusalem, et lequel un build vise.
 *
 *   production  le site petite-jerusalem.fr et l'app des boutiques. Son
 *               projet Firebase s'appelle `petite-jerusalem-dev` pour des
 *               raisons historiques : c'est bien la production, il n'y en a
 *               pas d'autre.
 *   staging     le projet Firebase `petite-jerusalem-staging`, son site
 *               petite-jerusalem-staging.web.app et « PJ Staging », une
 *               seconde app qui s'installe à côté de la vraie (identifiant
 *               distinct) et ne sort jamais de TestFlight ni de la piste de
 *               test interne du Play Store. Voir docs/staging.md.
 *
 * Le choix se fait par la variable PJ_ENV au moment du build (`staging`, ou
 * rien pour la production). Tout ce qui dépend de l'environnement se lit ici :
 * le bundle (vite.config.ts l'injecte en `__PJ_ENV__`), capacitor.config.ts
 * et les scripts natifs (setup-ios, setup-android, ios-signing). Un module
 * JavaScript plutôt que TypeScript pour que Node le lise tel quel en CI.
 */

/** Configuration publique (les clés Web Firebase ne sont pas des secrets). */
const PRODUCTION = {
  name: "production",
  firebase: {
    apiKey: "AIzaSyCykY9IonqmVpuA0VGICXnMWVtVNWlipnk",
    authDomain: "petite-jerusalem.fr",
    projectId: "petite-jerusalem-dev",
    storageBucket: "petite-jerusalem-dev.firebasestorage.app",
    messagingSenderId: "152837353533",
    appId: "1:152837353533:web:f98a0d34a8c2e834d07a54",
    measurementId: "G-YCXXL5PMK0",
  },
  siteUrl: "https://petite-jerusalem.fr",
  /** Bundle id iOS et applicationId Android. */
  appId: "fr.petitejerusalem.app",
  appName: "Petite Jérusalem",
  /** App Group partagé par l'app iOS, ses widgets et sa montre. */
  appGroup: "group.fr.petitejerusalem.app",
};

const STAGING = {
  name: "staging",
  firebase: {
    apiKey: "AIzaSyCPMzr_y5Fxh8SJAbYpTgmlZq_ZnVSmnis",
    authDomain: "petite-jerusalem-staging.firebaseapp.com",
    projectId: "petite-jerusalem-staging",
    storageBucket: "petite-jerusalem-staging.firebasestorage.app",
    messagingSenderId: "388713166885",
    appId: "1:388713166885:web:f9d9afbe572705148967cc",
  },
  siteUrl: "https://petite-jerusalem-staging.web.app",
  appId: "fr.petitejerusalem.app.staging",
  appName: "PJ Staging",
  appGroup: "group.fr.petitejerusalem.app.staging",
};

export const ENVIRONMENTS = { production: PRODUCTION, staging: STAGING };

/**
 * L'environnement nommé (PJ_ENV par défaut). Un nom inconnu arrête le build :
 * une faute de frappe ne doit jamais retomber en silence sur la production.
 */
export function resolveEnvironment(name = process.env.PJ_ENV) {
  const key = name?.trim() || "production";
  const env = ENVIRONMENTS[key];
  if (!env) {
    throw new Error(`PJ_ENV inconnu : « ${key} » (attendu : ${Object.keys(ENVIRONMENTS).join(", ")})`);
  }
  return env;
}

/** L'environnement de ce build. */
export const ENV = resolveEnvironment();
