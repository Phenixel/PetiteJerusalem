#!/usr/bin/env node
/**
 * Recopie le contenu public de la production dans le projet de staging, pour
 * que « PJ Staging » ne s'ouvre pas sur une app vide (docs/staging.md).
 *
 *   node scripts/staging-sync.mjs              essai : ce qui serait copié
 *   node scripts/staging-sync.mjs --confirmer  copie pour de bon
 *   … --compte admin@phenixel.fr               avec ce compte gcloud plutôt
 *                                              que l'ADC du poste
 *
 * Seules les collections publiques passent : celles que les règles Firestore
 * laissent lire à tout le monde et qui ne parlent de personne (chiourim,
 * auteurs, séries, informations). Jamais les sessions (noms des participants),
 * les signalements, les jetons du studio ni les préférences des comptes : ce
 * sont des données personnelles, elles n'ont rien à faire hors de la
 * production (RGPD).
 *
 * Chaque document garde son identifiant ; un document déjà présent en staging
 * est remplacé, un document qui n'existe qu'en staging est laissé tel quel.
 * Les sous-collections ne sont pas copiées. Les fichiers audio ne le sont pas
 * non plus : les chiourim copiés pointent vers ceux de la production, que le
 * staging lit comme n'importe quel visiteur.
 *
 * Identifiants : l'ADC du poste (`gcloud auth application-default login` avec
 * admin@phenixel.fr), qui doit pouvoir lire la production et écrire en
 * staging. Quand l'ADC sert un autre compte, --compte emprunte le jeton d'un
 * compte connecté à gcloud (`gcloud auth login`), sans toucher à l'ADC.
 * firebase-admin vient des functions : `npm ci --prefix functions`.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { ENVIRONMENTS } from "./lib/environments.mjs";

/** Les collections publiques, les seules copiées. */
export const PUBLIC_COLLECTIONS = ["chiourim", "auteurs", "series", "announcements"];

/** Firestore limite un lot d'écritures à 500 opérations. */
const BATCH_SIZE = 400;

const { values: opts } = parseArgs({
  options: {
    confirmer: { type: "boolean" },
    compte: { type: "string" },
    aide: { type: "boolean", short: "h" },
  },
  strict: true,
});

if (opts.aide) {
  console.log("Usage : node scripts/staging-sync.mjs [--confirmer] [--compte <e-mail gcloud>]");
  process.exit(0);
}

// Le client Firestore que firebase-admin embarque : il accepte un client
// OAuth2 tout prêt, ce qui permet --compte sans passer par l'ADC.
const requireFromFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
let Firestore, OAuth2Client;
try {
  ({ Firestore } = requireFromFunctions("@google-cloud/firestore"));
  ({ OAuth2Client } = requireFromFunctions("google-auth-library"));
} catch {
  console.error("staging-sync: firebase-admin introuvable, lancer d'abord `npm ci --prefix functions`.");
  process.exit(1);
}

/** Le jeton du compte gcloud demandé (valable une heure, bien assez ici). */
let authClient;
if (opts.compte) {
  const token = execFileSync("gcloud", [`--account=${opts.compte}`, "auth", "print-access-token"], {
    encoding: "utf8",
  }).trim();
  authClient = new OAuth2Client();
  authClient.setCredentials({ access_token: token });
}
const connect = (env) =>
  new Firestore({ projectId: env.firebase.projectId, ...(authClient ? { authClient } : {}) });
const source = connect(ENVIRONMENTS.production);
const target = connect(ENVIRONMENTS.staging);

const apply = opts.confirmer === true;
let total = 0;
for (const name of PUBLIC_COLLECTIONS) {
  const snapshot = await source.collection(name).get();
  total += snapshot.size;
  if (!apply) {
    console.log(`[essai] ${name} : ${snapshot.size} document(s) à copier`);
    continue;
  }
  for (let start = 0; start < snapshot.docs.length; start += BATCH_SIZE) {
    const batch = target.batch();
    for (const doc of snapshot.docs.slice(start, start + BATCH_SIZE)) {
      batch.set(target.collection(name).doc(doc.id), doc.data());
    }
    await batch.commit();
  }
  console.log(`${name} : ${snapshot.size} document(s) copié(s)`);
}

console.log(
  apply
    ? `staging-sync: ${total} document(s) copié(s) de la production vers le staging.`
    : `staging-sync: ${total} document(s) seraient copiés. Rien n'est écrit : relancer avec --confirmer.`,
);
