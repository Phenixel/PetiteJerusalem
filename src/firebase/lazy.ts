import type { Firestore } from "firebase/firestore";

/**
 * Chargement à la demande de Firestore.
 *
 * Le SDK (~170 kB gzip) n'a pas sa place dans le bundle initial (voir
 * src/__tests__/initialBundle.test.ts) : les services touchés dès le
 * démarrage (préférences, modération, tirés par authService) l'importent
 * donc en dynamique. Ce module ne contient que des `import()` : l'importer
 * en statique ne tire rien.
 */

export type FirestoreSdk = Awaited<ReturnType<typeof importFirestore>>;

function importFirestore() {
  return import("firebase/firestore");
}

export async function loadFirestore(): Promise<{ sdk: FirestoreSdk; db: Firestore }> {
  const [sdk, { db }] = await Promise.all([importFirestore(), import("./firestore")]);
  return { sdk, db };
}
