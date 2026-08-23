#!/usr/bin/env node
/**
 * Soumet la version App Store à l'examen, une fois le binaire traité par Apple.
 *
 * Tourne dans le job `submit` de deploy-ios.yml (Linux), APRÈS le job macOS :
 * le traitement d'un build par Apple prend 15 à 40 minutes, et poller depuis
 * le runner macOS gaspillerait des minutes facturées 10× plus cher. Étapes :
 *
 *   1. attendre que le build (CFBundleVersion dérivé du tag) apparaisse et
 *      passe à l'état VALID, échec franc s'il finit FAILED/INVALID ;
 *   2. déclarer usesNonExemptEncryption=false si Apple pose la question
 *      (filet de sécurité : ITSAppUsesNonExemptEncryption=false est déjà dans
 *      l'Info.plist via scripts/setup-ios.mjs, HTTPS seulement = exempt) ;
 *   3. attacher le build à la version App Store du tag, créée ou renommée en
 *      amont par scripts/appstore-listing.mjs dans le job macOS ;
 *   4. créer la « review submission » et l'envoyer. La mise en vente, elle, se
 *      fait toute seule dès l'accord d'Apple : scripts/appstore-listing.mjs
 *      pose la version en releaseType AFTER_APPROVAL (sauf IOS_AUTO_RELEASE=false).
 *
 * Cas assumés sans soumission : version déjà soumise ou publiée (re-run d'un
 * tag) → sortie 0 ; une autre soumission encore ouverte dans App Store
 * Connect (tag précédent toujours en examen) → sortie 1 avec le geste à faire.
 *
 * Usage :
 *   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_PRIVATE_KEY="$(cat AuthKey_XXX.p8)" \
 *     node scripts/asc-submit.mjs --version 3.7.3 --build-number 3070300 \
 *       [--timeout-minutes 45]
 */
import { createPrivateKey, sign as cryptoSign } from "node:crypto";

const BUNDLE_ID = "fr.petitejerusalem.app";

const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index !== -1 ? process.argv[index + 1] : null;
};
const versionString = arg("--version");
const buildNumber = arg("--build-number");
const timeoutMinutes = Number(arg("--timeout-minutes") ?? 45);
if (!versionString || !buildNumber) {
  console.error("asc-submit: --version et --build-number sont requis (ex. --version 3.7.3 --build-number 3070300)");
  process.exit(1);
}

// Les secrets collés dans l'interface GitHub embarquent facilement un blanc ou
// un retour à la ligne, ce job reçoit les secrets BRUTS (pas la normalisation
// GITHUB_ENV du job macOS), donc .trim() comme les autres scripts Node.
const keyId = process.env.ASC_KEY_ID?.trim();
const issuerId = process.env.ASC_ISSUER_ID?.trim();
const privateKeyPem = process.env.ASC_PRIVATE_KEY;
if (!keyId || !issuerId || !privateKeyPem) {
  console.error("asc-submit: ASC_KEY_ID, ASC_ISSUER_ID et ASC_PRIVATE_KEY sont requis, voir docs/ios-ci-cd.md");
  process.exit(1);
}

const base64url = (input) =>
  Buffer.from(input).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

// Le jeton Apple vit 20 minutes au maximum, mais ce script peut poller plus de
// 40 : contrairement aux autres scripts ASC (une exécution courte, un seul
// jeton), celui-ci re-signe un jeton frais toutes les 10 minutes.
let cachedToken = null;
let cachedAt = 0;
function appStoreConnectToken() {
  if (cachedToken && Date.now() - cachedAt < 10 * 60 * 1000) return cachedToken;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = { iss: issuerId, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(privateKeyPem.replaceAll("\\n", "\n")),
    dsaEncoding: "ieee-p1363",
  });
  cachedToken = `${signingInput}.${base64url(signature)}`;
  cachedAt = Date.now();
  return cachedToken;
}

async function api(method, path, body) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${appStoreConnectToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = json?.errors?.map((e) => `${e.title} : ${e.detail}`).join("\n  ") ?? text;
    const error = new Error(`${method} ${path} → ${response.status}\n  ${detail}`);
    error.status = response.status;
    error.body = json;
    throw error;
  }
  return json;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- App ---------------------------------------------------------------------
const apps = await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
const app = apps.data[0];
if (!app) {
  console.error(`asc-submit: aucune app ${BUNDLE_ID} dans App Store Connect`);
  process.exit(1);
}

// --- 1. Attendre le traitement du build --------------------------------------
console.log(`asc-submit: attente du build ${buildNumber} (version ${versionString}), délai max ${timeoutMinutes} min…`);
const deadline = Date.now() + timeoutMinutes * 60 * 1000;
let build = null;
for (;;) {
  const builds = await api(
    "GET",
    `/v1/builds?filter[app]=${app.id}&filter[version]=${buildNumber}` +
      `&filter[preReleaseVersion.version]=${versionString}&sort=-uploadedDate&limit=1`,
  );
  build = builds.data[0] ?? null;
  const state = build?.attributes.processingState;
  if (state === "VALID") break;
  if (state === "FAILED" || state === "INVALID") {
    console.error(`asc-submit: le build ${buildNumber} a été rejeté par le traitement Apple (${state}), voir les e-mails App Store Connect.`);
    process.exit(1);
  }
  if (Date.now() > deadline) {
    console.error(
      `asc-submit: build ${buildNumber} toujours ${state ?? "absent"} après ${timeoutMinutes} min, ` +
        "relancer ce job quand TestFlight l'affiche, ou soumettre à la main.",
    );
    process.exit(1);
  }
  console.log(`asc-submit: build ${state ?? "pas encore visible"}, nouvel essai dans 60 s`);
  await sleep(60 * 1000);
}
console.log(`asc-submit: build ${buildNumber} traité (VALID)`);

// --- 2. Conformité export (filet de sécurité) --------------------------------
// null = Apple pose la question et bloque la soumission. L'Info.plist répond
// déjà false (setup-ios.mjs) ; on ne réécrit jamais une valeur déjà posée.
if (build.attributes.usesNonExemptEncryption == null) {
  await api("PATCH", `/v1/builds/${build.id}`, {
    data: { type: "builds", id: build.id, attributes: { usesNonExemptEncryption: false } },
  });
  console.log("asc-submit: usesNonExemptEncryption=false déclaré sur le build");
}

// --- 3. Attacher le build à la version du tag --------------------------------
// Mêmes états « modifiables » que scripts/appstore-listing.mjs, qui vient de
// créer ou renommer cette version dans le job macOS.
const EDITABLE_STATES = [
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "INVALID_BINARY",
];
const versions = await api(
  "GET",
  `/v1/apps/${app.id}/appStoreVersions?filter[versionString]=${versionString}&limit=5`,
);
const version = versions.data[0];
if (!version) {
  console.error(
    `asc-submit: aucune version ${versionString} dans App Store Connect, ` +
      "l'étape « Mettre à jour la fiche App Store » du job iOS a dû échouer (elle la crée) ; corriger puis relancer.",
  );
  process.exit(1);
}
const versionState = version.attributes.appVersionState ?? version.attributes.appStoreState;
if (!EDITABLE_STATES.includes(versionState)) {
  // Re-run d'un tag déjà soumis, ou version déjà publiée : rien à faire.
  console.log(`asc-submit: version ${versionString} déjà soumise ou publiée (${versionState}), rien à faire.`);
  process.exit(0);
}
await api("PATCH", `/v1/appStoreVersions/${version.id}/relationships/build`, {
  data: { type: "builds", id: build.id },
});
console.log(`asc-submit: build ${buildNumber} attaché à la version ${versionString}`);

// --- 4. Soumettre à l'examen -------------------------------------------------
// Une seule soumission ouverte par plateforme : un brouillon (READY_FOR_REVIEW)
// est réutilisé, une soumission déjà partie (tag précédent en examen) arrête
// le script, la re-soumission se décide dans App Store Connect, pas ici.
const OPEN_STATES = ["WAITING_FOR_REVIEW", "IN_REVIEW", "UNRESOLVED_ISSUES", "CANCELING", "COMPLETING"];
const submissions = await api(
  "GET",
  `/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=${["READY_FOR_REVIEW", ...OPEN_STATES].join(",")}`,
);
const open = submissions.data.find((s) => OPEN_STATES.includes(s.attributes.state));
if (open) {
  console.error(
    `asc-submit: une soumission est déjà en cours (état ${open.attributes.state}), ` +
      `l'annuler ou attendre son verdict dans App Store Connect avant de soumettre ${versionString}.`,
  );
  process.exit(1);
}

let submission = submissions.data.find((s) => s.attributes.state === "READY_FOR_REVIEW");
if (submission) {
  console.log("asc-submit: brouillon de soumission existant réutilisé");
} else {
  submission = await api("POST", "/v1/reviewSubmissions", {
    data: {
      type: "reviewSubmissions",
      attributes: { platform: "IOS" },
      relationships: { app: { data: { type: "apps", id: app.id } } },
    },
  }).then((r) => r.data);
}

try {
  await api("POST", "/v1/reviewSubmissionItems", {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: { data: { type: "reviewSubmissions", id: submission.id } },
        appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
      },
    },
  });
} catch (error) {
  // Brouillon réutilisé qui contient déjà cette version : pas une erreur.
  if (error.status !== 409) throw error;
  console.log("asc-submit: la version est déjà dans la soumission");
}

await api("PATCH", `/v1/reviewSubmissions/${submission.id}`, {
  data: { type: "reviewSubmissions", id: submission.id, attributes: { submitted: true } },
});
console.log(`asc-submit: version ${versionString} (build ${buildNumber}) soumise à l'examen ✓`);
console.log(
  "asc-submit: la mise en vente se fera d'elle-même dès l'accord d'Apple (releaseType AFTER_APPROVAL, posé par appstore-listing.mjs).",
);
