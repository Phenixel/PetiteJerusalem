#!/usr/bin/env node
/**
 * Signature iOS en CI : fabrique un certificat de distribution et les profils
 * « App Store » via l'API App Store Connect, les installe sur le runner. Deux
 * profils : celui de l'app, et celui de l'extension de widgets, qui a son
 * propre App ID (fr.petitejerusalem.app.PjWidgets). Les profils sont détruits
 * en fin de run ; le certificat, NON, voir plus bas.
 *
 * Pourquoi ne pas laisser xcodebuild signer tout seul (-allowProvisioningUpdates) :
 * `xcodebuild archive` en signature AUTOMATIQUE réclame un profil de
 * *développement* (« No profiles for 'fr.petitejerusalem.app' were found:
 * Xcode couldn't find any iOS App Development provisioning profiles »), et un
 * profil de développement exige au moins un appareil enregistré dans l'équipe.
 * Le compte est un compte individuel sans appareil : impasse. Forcer
 * CODE_SIGN_IDENTITY="Apple Distribution" par-dessus le mode automatique ne
 * marche pas non plus, Xcode refuse le mélange (« has conflicting
 * provisioning settings ») sur la cible App *et* sur chaque paquet SPM.
 *
 * D'où la signature MANUELLE : un profil « App Store » n'a besoin d'aucun
 * appareil.
 *
 * QUAND LE CERTIFICAT DU RUN EST RÉVOQUÉ, ET QUAND IL SURVIT
 * Il était autrefois révoqué à tous les coups, en pariant qu'« Apple re-signe
 * tout ce qui passe par TestFlight et l'App Store ». C'est faux pour l'examen :
 * Apple re-valide la signature D'ORIGINE au moment de la soumission. Le build
 * 3.7.3 (3070300) a été accepté par TestFlight le 17 août 2026, installé et
 * testé, puis rejeté dès sa mise en file d'examen : « ITMS-90035: Invalid
 * Signature », parce que son certificat avait été révoqué quelques minutes
 * après l'envoi. Un certificat doit donc survivre à tout binaire signé avec
 * lui tant que celui-ci est en examen ou en vente. Seul le profil est
 * éphémère en toutes circonstances : le recréer est sans conséquence.
 *
 * Mais Apple plafonne le compte à TROIS certificats de distribution, et les
 * garder tous a fini par bloquer le tag v3.7.8 : « You already have a current
 * Distribution certificate ». Trois mécanismes tiennent le compte sous le
 * quota, sans jamais toucher à un certificat encore utile :
 *   --cleanup révoque le certificat du run si rien n'est parti chez Apple
 *     (échec avant l'envoi, run de debug) : il ne signe alors aucun binaire.
 *     C'est la variable IOS_BUILD_UPLOADED, posée par deploy-ios.yml juste
 *     après l'envoi sur TestFlight, qui distingue les deux cas ;
 *   --cleanup CONSERVE au contraire le profil quand le binaire est parti : son
 *     nom porte le numéro de build et il référence le certificat signataire.
 *     Ce marqueur est la seule trace du lien entre un certificat et ce qu'il a
 *     signé, l'API App Store Connect ne le donnant pas ;
 *   --setup, à chaque run, révoque les certificats dont plus aucun binaire ne
 *     dépend : marqueur à l'appui quand il existe, déduction par les dates
 *     sinon. Qui peut partir se décide dans scripts/lib/certificate-quota.mjs,
 *     testé sans réseau ni macOS ; si rien n'est libérable et que le quota est
 *     plein, le run échoue avec la liste des certificats et la raison qui
 *     retient chacun.
 *
 * Rien n'est stocké dans le repo : ni .p12, ni profil, ni mot de passe.
 *
 * Usage :
 *   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_PRIVATE_KEY=… IOS_DEVELOPMENT_TEAM=… \
 *     IOS_BUILD_NUMBER=3070800 node scripts/ios-signing.mjs --setup
 *   … node scripts/ios-signing.mjs --cleanup     (idempotent, ne casse jamais le run)
 *
 * --setup écrit dans $GITHUB_ENV (lues ensuite par scripts/setup-ios.mjs et
 * par l'export de l'IPA) :
 *   IOS_PROVISIONING_PROFILE     nom du profil de l'app (PROVISIONING_PROFILE_SPECIFIER)
 *   IOS_WIDGET_PROVISIONING_PROFILE  celui de l'extension de widgets
 *   IOS_WATCH_PROVISIONING_PROFILE   celui de l'app Apple Watch
 *   IOS_CODE_SIGN_IDENTITY       nom complet de l'identité de signature
 *   IOS_SIGNING_CERTIFICATE_ID   id ASC du certificat (--cleanup ne le révoque
 *                                que si le run n'a rien envoyé, cf. plus haut)
 *   IOS_SIGNING_PROFILE_ID       id ASC du profil de l'app, pour --cleanup (qui
 *                                ne le supprime que si le run n'a rien envoyé)
 *   IOS_WIDGET_SIGNING_PROFILE_ID  id ASC du profil de l'extension, toujours
 *                                supprimé au nettoyage : le marqueur du
 *                                certificat, c'est celui de l'app
 *   IOS_WATCH_SIGNING_PROFILE_ID   id ASC du profil de l'app de montre, idem
 *   IOS_SIGNING_KEYCHAIN         trousseau temporaire, pour --cleanup
 */
import { execFileSync } from "node:child_process";
import { createPrivateKey, randomBytes, sign as cryptoSign } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  CERTIFICATE_QUOTA,
  distributionCertificates,
  protectedUploads,
  revocableCertificates,
} from "./lib/certificate-quota.mjs";
import { APP_GROUP, WIDGET_TARGET } from "./lib/xcode-widgets.mjs";
import { WATCH_BUNDLE_SUFFIX } from "./lib/xcode-watch.mjs";

const BUNDLE_ID = "fr.petitejerusalem.app";
// L'extension de widgets est un binaire à part, avec son App ID et son profil
// (docs/app-widgets.md).
const WIDGET_BUNDLE_ID = `${BUNDLE_ID}.${WIDGET_TARGET}`;
// L'app de montre aussi : elle est embarquée dans l'IPA, mais c'est une
// application à part entière, avec son App ID et son profil (docs/app-watch.md).
const WATCH_BUNDLE_ID = `${BUNDLE_ID}.${WATCH_BUNDLE_SUFFIX}`;
// Préfixe reconnaissable : --setup fait le ménage des profils laissés par un
// run interrompu avant son étape de nettoyage.
const PROFILE_PREFIX = "PetiteJerusalem CI";
// Le profil d'un run qui a envoyé son binaire n'est PAS supprimé : son nom
// porte le numéro de build et il référence le certificat signataire, ce que
// l'API ne dit nulle part ailleurs. C'est ce marqueur qui permet, aux runs
// suivants, de révoquer un certificat en sachant exactement ce qu'il a signé.
const markerName = (buildNumber) => `${PROFILE_PREFIX} build ${buildNumber}`;
const MARKER_PATTERN = new RegExp(`^${PROFILE_PREFIX} build (\\d+)$`);
const buildNumber = process.env.IOS_BUILD_NUMBER?.trim();
// Capacités que les profils doivent couvrir, sous peine d'échec de signature
// (« doesn't match the entitlements file »). En signature automatique, Xcode
// les activait lui-même sur l'App ID ; en manuel, c'est à nous. La capacité
// doit être active sur l'App ID AVANT la création du profil.
// ASSOCIATED_DOMAINS : les liens du site ouvrent l'app (docs/app-links.md).
// APP_GROUPS : l'app et son extension de widgets se parlent par là, et par là
// seulement. Activer la capacité est tout ce que l'API sait faire : créer le
// groupe et l'attacher aux deux App ID reste une manipulation manuelle, une
// fois pour toutes, dans le portail Apple. C'est pourquoi les profils sont
// relus plus bas : mieux vaut échouer ici, en une phrase, qu'un quart d'heure
// plus tard sur un message de codesign.
const CAPABILITIES = ["PUSH_NOTIFICATIONS", "APPLE_ID_AUTH", "ASSOCIATED_DOMAINS", "APP_GROUPS"];
const WIDGET_CAPABILITIES = ["APP_GROUPS"];

const mode = process.argv.includes("--cleanup") ? "cleanup" : "setup";
const isCleanup = mode === "cleanup";

const keyId = process.env.ASC_KEY_ID?.trim();
const issuerId = process.env.ASC_ISSUER_ID?.trim();
const privateKeyPem = process.env.ASC_PRIVATE_KEY;
if (!keyId || !issuerId || !privateKeyPem) {
  // Au nettoyage, l'absence de secrets ne doit pas transformer un run vert en
  // rouge : il n'y a de toute façon rien à supprimer.
  if (isCleanup) process.exit(0);
  console.error("ios-signing: ASC_KEY_ID, ASC_ISSUER_ID et ASC_PRIVATE_KEY sont requis");
  process.exit(1);
}

// LibreSSL (/usr/bin/openssl sur macOS) produit un PKCS#12 que `security
// import` avale sans discuter ; l'OpenSSL 3 de Homebrew chiffre par défaut
// avec des algorithmes que le trousseau lit mal selon les versions.
const OPENSSL = existsSync("/usr/bin/openssl") ? "/usr/bin/openssl" : "openssl";

/** execFileSync avec sortie texte ; les secrets ne transitent jamais par un shell. */
function run(cmd, args, { allowFailure = false } = {}) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    if (allowFailure) return null;
    const detail = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${cmd} ${args[0] ?? ""} a échoué\n  ${detail || error.message}`);
  }
}

// --- API App Store Connect --------------------------------------------------
const base64url = (input) =>
  Buffer.from(input).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const now = Math.floor(Date.now() / 1000);
const header = { alg: "ES256", kid: keyId, typ: "JWT" };
const payload = { iss: issuerId, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };
const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
const token = `${signingInput}.${base64url(
  cryptoSign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(privateKeyPem.replaceAll("\\n", "\n")),
    dsaEncoding: "ieee-p1363",
  }),
)}`;

async function api(method, path, body) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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

/** Expose une valeur aux étapes suivantes du job (no-op hors GitHub Actions). */
function exportEnv(name, value) {
  process.env[name] = value;
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}

const workDir = process.env.RUNNER_TEMP || tmpdir();
const keychainPath = join(workDir, "petitejerusalem-signing.keychain-db");

// ---------------------------------------------------------------------------
// Nettoyage : supprime le profil, le trousseau, et le certificat du run si
// celui-ci n'a envoyé aucun binaire.
// ---------------------------------------------------------------------------
// Révoquer le certificat d'un binaire déjà envoyé invaliderait sa signature
// dès qu'Apple la re-valide à la soumission à l'examen (ITMS-90035) : c'est
// IOS_BUILD_UPLOADED qui tranche, l'en-tête du fichier détaille le cas.
if (isCleanup) {
  const profileId = process.env.IOS_SIGNING_PROFILE_ID;
  if (profileId && process.env.IOS_BUILD_UPLOADED) {
    // Le profil devient le marqueur du binaire envoyé : il dit au prochain run
    // quel certificat a signé quel build. Il sera supprimé, avec le
    // certificat, quand ce build n'attendra plus rien d'Apple.
    console.log(`ios-signing: profil « ${process.env.IOS_PROVISIONING_PROFILE} » conservé, il marque le binaire envoyé`);
  } else if (profileId) {
    try {
      await api("DELETE", `/v1/profiles/${profileId}`);
      console.log("ios-signing: profil supprimé côté Apple");
    } catch (error) {
      // Un nettoyage raté ne doit pas masquer le résultat du run : le pire cas
      // est un profil de trop, que le run suivant supprimera de toute façon.
      console.warn(`ios-signing: ⚠️ profil non supprimé, ${error.message}`);
    }
  }
  // Le profil de l'extension part dans tous les cas : c'est celui de l'app qui
  // sert de marqueur (nom porteur du numéro de build, certificat référencé),
  // et un profil supprimé côté Apple n'invalide pas un binaire déjà signé.
  for (const [label, id] of [
    ["l'extension de widgets", process.env.IOS_WIDGET_SIGNING_PROFILE_ID],
    ["l'app de montre", process.env.IOS_WATCH_SIGNING_PROFILE_ID],
  ]) {
    if (!id) continue;
    try {
      await api("DELETE", `/v1/profiles/${id}`);
      console.log(`ios-signing: profil de ${label} supprimé côté Apple`);
    } catch (error) {
      console.warn(`ios-signing: ⚠️ profil de ${label} non supprimé, ${error.message}`);
    }
  }
  const runCertificateId = process.env.IOS_SIGNING_CERTIFICATE_ID;
  if (runCertificateId && process.env.IOS_BUILD_UPLOADED) {
    console.log(
      `ios-signing: certificat ${runCertificateId} conservé, il signe un binaire qu'Apple regarde encore`,
    );
  } else if (runCertificateId) {
    // Aucun binaire n'est parti chez Apple : ce certificat ne signe rien que
    // qui que ce soit re-validera, et le garder mangerait une place du quota
    // pendant un an. Seul l'IPA archivé dans l'onglet Actions devient
    // inutilisable pour un envoi manuel ; il faut alors relancer le run.
    try {
      await api("DELETE", `/v1/certificates/${runCertificateId}`);
      console.log(`ios-signing: certificat ${runCertificateId} révoqué, le run n'a envoyé aucun binaire`);
    } catch (error) {
      console.warn(`ios-signing: ⚠️ certificat ${runCertificateId} non révoqué, ${error.message}`);
    }
  }
  const keychain = process.env.IOS_SIGNING_KEYCHAIN || keychainPath;
  if (existsSync(keychain)) {
    run("security", ["delete-keychain", keychain], { allowFailure: true });
    console.log("ios-signing: trousseau temporaire supprimé");
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 1. App ID et capacités
// ---------------------------------------------------------------------------
/** L'App ID d'un bundle id, ou null s'il n'existe pas encore. */
async function findBundleId(identifier) {
  const found = await api(
    "GET",
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&limit=200`,
  );
  // filter[identifier] est un « contains » côté Apple : on exige l'égalité.
  return found.data.find((entry) => entry.attributes.identifier === identifier) ?? null;
}

/** Active des capacités sur un App ID ; déjà actives, Apple le dit poliment. */
async function enableCapabilities(record, capabilities) {
  for (const capabilityType of capabilities) {
    try {
      await api("POST", "/v1/bundleIdCapabilities", {
        data: {
          type: "bundleIdCapabilities",
          attributes: { capabilityType },
          relationships: { bundleId: { data: { type: "bundleIds", id: record.id } } },
        },
      });
      console.log(`ios-signing: capacité ${capabilityType} activée sur ${record.attributes.identifier}`);
    } catch (error) {
      // Capacité déjà active : c'est le cas nominal dès le deuxième run. Apple
      // répond 409, ou 400 avec « already exists » selon les endpoints.
      const alreadyThere =
        error.status === 409 || (error.status === 400 && /already|exist/i.test(error.message));
      if (alreadyThere) {
        console.log(`ios-signing: capacité ${capabilityType} déjà active sur ${record.attributes.identifier}`);
      } else throw error;
    }
  }
}

const bundleIdRecord = await findBundleId(BUNDLE_ID);
if (!bundleIdRecord) {
  console.error(
    `ios-signing: aucun App ID « ${BUNDLE_ID} » dans le compte développeur.\n` +
      "  Le créer sur developer.apple.com → Certificates, Identifiers & Profiles → Identifiers.",
  );
  process.exit(1);
}
console.log(`ios-signing: App ID ${BUNDLE_ID} (${bundleIdRecord.id})`);
await enableCapabilities(bundleIdRecord, CAPABILITIES);

// L'App ID de l'extension de widgets. Celui-là, l'API sait le créer : c'est
// un identifiant ordinaire. Seul l'App Group lui-même échappe à l'API, d'où
// la relecture des profils, plus bas.
let widgetBundleIdRecord = await findBundleId(WIDGET_BUNDLE_ID);
if (!widgetBundleIdRecord) {
  const created = await api("POST", "/v1/bundleIds", {
    data: {
      type: "bundleIds",
      attributes: {
        identifier: WIDGET_BUNDLE_ID,
        // Apple n'accepte ici que des lettres, chiffres et espaces.
        name: "Petite Jerusalem Widgets",
        platform: "IOS",
      },
    },
  });
  widgetBundleIdRecord = created.data;
  console.log(`ios-signing: App ID ${WIDGET_BUNDLE_ID} créé (${widgetBundleIdRecord.id})`);
} else {
  console.log(`ios-signing: App ID ${WIDGET_BUNDLE_ID} (${widgetBundleIdRecord.id})`);
}
await enableCapabilities(widgetBundleIdRecord, WIDGET_CAPABILITIES);

// L'App ID de l'app de montre. Aucune capacité à activer : elle ne parle qu'au
// téléphone, par WatchConnectivity, qui n'en demande aucune. Apple range les
// App ID watchOS sous la plateforme iOS, comme ceux des extensions.
let watchBundleIdRecord = await findBundleId(WATCH_BUNDLE_ID);
if (!watchBundleIdRecord) {
  const created = await api("POST", "/v1/bundleIds", {
    data: {
      type: "bundleIds",
      attributes: {
        identifier: WATCH_BUNDLE_ID,
        // Apple n'accepte ici que des lettres, chiffres et espaces.
        name: "Petite Jerusalem Watch",
        platform: "IOS",
      },
    },
  });
  watchBundleIdRecord = created.data;
  console.log(`ios-signing: App ID ${WATCH_BUNDLE_ID} créé (${watchBundleIdRecord.id})`);
} else {
  console.log(`ios-signing: App ID ${WATCH_BUNDLE_ID} (${watchBundleIdRecord.id})`);
}

/**
 * Le ménage des certificats, à chaque run et pas seulement quand le quota est
 * atteint : tout certificat dont plus aucun binaire ne dépend part, ce qui
 * laisse toujours une place d'avance. La décision est dans
 * scripts/lib/certificate-quota.mjs ; ici, les appels à Apple. Un inventaire
 * impossible ne révoque rien du tout : mieux vaut un run rouge qu'une
 * signature invalidée sous un binaire en examen.
 */
async function pruneCertificates(certificates, signedBuilds) {
  let revocable;
  try {
    const apps = await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
    const app = apps.data[0];
    if (!app) throw new Error(`aucune app ${BUNDLE_ID} dans App Store Connect`);
    const [versions, builds] = await Promise.all([
      api("GET", `/v1/apps/${app.id}/appStoreVersions?limit=20&include=build`),
      api("GET", `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5`),
    ]);
    revocable = revocableCertificates(certificates, protectedUploads(versions, builds), signedBuilds);
  } catch (error) {
    console.warn(`ios-signing: ⚠️ inventaire des binaires impossible, aucun certificat révoqué, ${error.message}`);
    return;
  }
  for (const certificate of revocable) {
    try {
      await api("DELETE", `/v1/certificates/${certificate.id}`);
      certificate.revoked = true;
      console.log(
        `ios-signing: certificat ${certificate.id} révoqué, plus aucun binaire qu'Apple regarde encore n'en dépend`,
      );
    } catch (error) {
      console.warn(`ios-signing: ⚠️ certificat ${certificate.id} non révoqué, ${error.message}`);
    }
  }
  for (const certificate of certificates) {
    if (certificate.keptFor) console.log(`ios-signing: certificat ${certificate.id} conservé, ${certificate.keptFor}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Certificat de distribution (clé privée générée ici, jamais transmise)
// ---------------------------------------------------------------------------
const password = randomBytes(24).toString("hex");
const keyPath = join(workDir, "signing-key.pem");
const csrPath = join(workDir, "signing.csr");
const cerPath = join(workDir, "signing.cer");
const pemPath = join(workDir, "signing-cert.pem");
const p12Path = join(workDir, "signing.p12");

run(OPENSSL, [
  "req",
  "-new",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  keyPath,
  "-out",
  csrPath,
  "-subj",
  "/CN=Petite Jerusalem CI/O=Petite Jerusalem/C=FR",
]);

// Apple plafonne le compte à trois certificats de distribution et celui d'un
// run lui survit (cf. l'en-tête) : sans ce ménage, un tag finit par échouer
// sur « You already have a current Distribution certificate », ce qui est
// arrivé au tag v3.7.8.
//
// Les profils marqueurs sont lus d'abord : ils disent quel certificat a signé
// quel build, et ce sont eux qui rendent la révocation sûre. `include` peuple
// la relation, sans quoi l'API ne rend que des liens.
const profiles = await api("GET", "/v1/profiles?limit=200&include=certificates").catch((error) => {
  console.warn(`ios-signing: ⚠️ profils illisibles, provenance des certificats inconnue, ${error.message}`);
  return { data: [] };
});
/** @type {Map<string, string>} id de certificat vers numéro de build signé */
const signedBuilds = new Map();
for (const profile of profiles.data) {
  const signed = MARKER_PATTERN.exec(profile.attributes?.name ?? "")?.[1];
  if (!signed) continue;
  for (const linked of profile.relationships?.certificates?.data ?? []) signedBuilds.set(linked.id, signed);
}

const certificates = distributionCertificates(
  (await api("GET", "/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=200")).data,
);
await pruneCertificates(certificates, signedBuilds);

let certificate;
try {
  certificate = await api("POST", "/v1/certificates", {
    data: {
      type: "certificates",
      attributes: { certificateType: "DISTRIBUTION", csrContent: readFileSync(csrPath, "utf8") },
    },
  });
} catch (error) {
  if (error.status === 403 || error.status === 409) {
    const remaining = certificates.filter((c) => !c.revoked);
    console.error(
      `ios-signing: Apple refuse de créer un certificat de distribution, ${error.message}\n` +
        `  ${remaining.length} certificat(s) de distribution occupent le quota (${CERTIFICATE_QUOTA}) :\n` +
        remaining
          .map(
            (c) =>
              `    ${c.id}  ${c.displayName}  expire le ${c.expiration}` +
              (c.keptFor ? `  (conservé, ${c.keptFor})` : ""),
          )
          .join("\n") +
        "\n  En révoquer un sur developer.apple.com → Certificates, une fois certain qu'aucun binaire" +
        "\n  signé avec lui n'est en examen ni en vente, puis relancer.",
    );
    process.exit(1);
  }
  throw error;
}
const certificateId = certificate.data.id;
// Écrit AVANT toute autre opération : si la suite échoue, l'étape de nettoyage
// (if: always()) doit malgré tout pouvoir révoquer ce certificat.
exportEnv("IOS_SIGNING_CERTIFICATE_ID", certificateId);
console.log(`ios-signing: certificat de distribution créé (${certificateId})`);

writeFileSync(cerPath, Buffer.from(certificate.data.attributes.certificateContent, "base64"));
run(OPENSSL, ["x509", "-inform", "DER", "-in", cerPath, "-out", pemPath]);
run(OPENSSL, [
  "pkcs12",
  "-export",
  "-inkey",
  keyPath,
  "-in",
  pemPath,
  "-out",
  p12Path,
  "-name",
  "Petite Jerusalem CI",
  "-passout",
  `pass:${password}`,
]);

// ---------------------------------------------------------------------------
// 3. Trousseau temporaire
// ---------------------------------------------------------------------------
if (existsSync(keychainPath)) run("security", ["delete-keychain", keychainPath], { allowFailure: true });
run("security", ["create-keychain", "-p", password, keychainPath]);
// -lut sans -l : pas de verrouillage pendant les 6 h que peut durer le job.
run("security", ["set-keychain-settings", "-lut", "21600", keychainPath]);
run("security", ["unlock-keychain", "-p", password, keychainPath]);
// La liste de recherche est remplacée, pas complétée : on réinjecte l'existant.
const searchList = run("security", ["list-keychains", "-d", "user"])
  .split("\n")
  .map((line) => line.trim().replace(/^"|"$/g, ""))
  .filter(Boolean)
  .filter((path) => path !== keychainPath);
run("security", ["list-keychains", "-d", "user", "-s", keychainPath, ...searchList]);
run("security", ["import", p12Path, "-k", keychainPath, "-P", password, "-A"]);
// Sans cette liste de partition, codesign déclencherait une invite graphique
// (impossible sur un runner) au moment d'utiliser la clé privée.
run("security", ["set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", password, keychainPath]);
exportEnv("IOS_SIGNING_KEYCHAIN", keychainPath);

// L'autorité intermédiaire d'Apple est normalement déjà dans le trousseau
// système du runner ; on la pose quand même pour que la chaîne du certificat
// soit complète quelle que soit l'image macOS.
try {
  const wwdr = await fetch("https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer");
  if (wwdr.ok) {
    const wwdrPath = join(workDir, "AppleWWDRCAG3.cer");
    writeFileSync(wwdrPath, Buffer.from(await wwdr.arrayBuffer()));
    run("security", ["import", wwdrPath, "-k", keychainPath, "-A"], { allowFailure: true });
  }
} catch {
  console.warn("ios-signing: ⚠️ autorité WWDR non téléchargée, on continue (elle est fournie par l'image macOS)");
}

for (const file of [keyPath, csrPath, cerPath, pemPath, p12Path]) rmSync(file, { force: true });

const identities = run("security", ["find-identity", "-v", "-p", "codesigning", keychainPath]);
// « 1) A1B2… "Apple Distribution: Yonathan Cardoso (98FSU96AH2)" »
const identity = identities.match(/"(Apple Distribution:[^"]+)"/)?.[1];
if (!identity) {
  console.error(
    `ios-signing: aucune identité « Apple Distribution » utilisable dans le trousseau.\n  ${identities.trim()}`,
  );
  process.exit(1);
}
exportEnv("IOS_CODE_SIGN_IDENTITY", identity);
console.log(`ios-signing: identité installée, ${identity}`);

// ---------------------------------------------------------------------------
// 4. Profil de provisionnement App Store
// ---------------------------------------------------------------------------
// Le nom porte le numéro de build : le profil restera en place si le binaire
// part chez Apple, et dira alors quel certificat l'a signé. Sans numéro de
// build (lancement hors CI), le profil est nommé sans marqueur, donc traité
// comme jetable.
const runSuffix = buildNumber ? `build ${buildNumber}` : `${process.env.GITHUB_RUN_ID ?? Date.now()}`;
const profileName = buildNumber ? markerName(buildNumber) : `${PROFILE_PREFIX} ${runSuffix}`;
// Le profil de l'extension ne suit PAS le motif du marqueur : il est jetable,
// le lien certificat/binaire étant déjà porté par celui de l'app.
const widgetProfileName = `${PROFILE_PREFIX} widgets ${runSuffix}`;
// Celui de la montre non plus : même raison.
const watchProfileName = `${PROFILE_PREFIX} montre ${runSuffix}`;
const disposableProfileNames = new Set([widgetProfileName, watchProfileName]);

// Ne survivent que les marqueurs d'un certificat encore vivant. Partent : les
// profils d'un run tué avant son nettoyage, ceux dont le certificat vient
// d'être révoqué ou l'a été à la main, et l'homonyme de celui qu'on crée
// (re-run d'un même tag), Apple refusant deux profils de même nom.
const liveCertificateIds = new Set([
  certificateId,
  ...certificates.filter((c) => !c.revoked).map((c) => c.id),
]);
for (const stale of profiles.data) {
  const name = stale.attributes?.name ?? "";
  if (!name.startsWith(PROFILE_PREFIX)) continue;
  if (disposableProfileNames.has(name)) {
    // Homonyme d'un profil jetable qu'on s'apprête à créer (re-run d'un même
    // tag) : Apple refuse deux profils de même nom.
    await api("DELETE", `/v1/profiles/${stale.id}`).catch(() => {});
    console.log(`ios-signing: ancien profil « ${name} » supprimé`);
    continue;
  }
  const marks = MARKER_PATTERN.test(name) && name !== profileName;
  const linked = stale.relationships?.certificates?.data ?? [];
  if (marks && linked.some((certificate) => liveCertificateIds.has(certificate.id))) continue;
  await api("DELETE", `/v1/profiles/${stale.id}`).catch(() => {});
  console.log(`ios-signing: ancien profil « ${name} » supprimé`);
}

/**
 * Crée un profil « App Store », l'installe sur le runner et rend son id.
 *
 * Xcode 16+ lit le second dossier ; les outils en ligne de commande plus
 * anciens lisent le premier. Les deux coûtent un fichier.
 */
async function createProfile(name, bundleRecord) {
  const created = await api("POST", "/v1/profiles", {
    data: {
      type: "profiles",
      attributes: { name, profileType: "IOS_APP_STORE" },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: bundleRecord.id } },
        certificates: { data: [{ type: "certificates", id: certificateId }] },
      },
    },
  });
  const content = Buffer.from(created.data.attributes.profileContent, "base64");
  const uuid = created.data.attributes.uuid;
  for (const dir of [
    join(homedir(), "Library/MobileDevice/Provisioning Profiles"),
    join(homedir(), "Library/Developer/Xcode/UserData/Provisioning Profiles"),
  ]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${uuid}.mobileprovision`), content);
  }
  console.log(`ios-signing: profil « ${name} » installé (${uuid})`);
  return { id: created.data.id, content };
}

/**
 * Un profil ne porte l'App Group que si celui-ci est attaché à l'App ID dans
 * le portail Apple, ce que l'API ne sait pas faire. Sans cette relecture,
 * l'oubli ne se verrait qu'un quart d'heure plus tard, sur un « doesn't match
 * the entitlements file » d'xcodebuild, et seulement pour qui sait le lire.
 *
 * Le .mobileprovision est un blob CMS signé qui contient son plist en clair :
 * il suffit d'y chercher le groupe.
 */
function assertAppGroup(content, identifier) {
  if (content.toString("latin1").includes(APP_GROUP)) return;
  console.error(
    `ios-signing: l'App Group ${APP_GROUP} n'est pas dans le profil de ${identifier}.\n` +
      "  L'API App Store Connect ne sait ni créer un App Group ni l'attacher à un App ID :\n" +
      "  c'est une manipulation à faire une fois, sur developer.apple.com →\n" +
      "  Certificates, Identifiers & Profiles :\n" +
      `    1. Identifiers → App Groups → + → identifiant « ${APP_GROUP} »\n` +
      `    2. Identifiers → ${BUNDLE_ID} → App Groups → Configure → cocher le groupe\n` +
      `    3. Identifiers → ${WIDGET_BUNDLE_ID} → App Groups → Configure → idem\n` +
      "  Puis relancer ce run. Détails dans docs/app-widgets.md.",
  );
  process.exit(1);
}

const profile = await createProfile(profileName, bundleIdRecord);
exportEnv("IOS_SIGNING_PROFILE_ID", profile.id);
exportEnv("IOS_PROVISIONING_PROFILE", profileName);
assertAppGroup(profile.content, BUNDLE_ID);

const widgetProfile = await createProfile(widgetProfileName, widgetBundleIdRecord);
exportEnv("IOS_WIDGET_SIGNING_PROFILE_ID", widgetProfile.id);
exportEnv("IOS_WIDGET_PROVISIONING_PROFILE", widgetProfileName);
assertAppGroup(widgetProfile.content, WIDGET_BUNDLE_ID);

// L'app de montre : pas d'App Group à relire, elle n'en a pas besoin.
const watchProfile = await createProfile(watchProfileName, watchBundleIdRecord);
exportEnv("IOS_WATCH_SIGNING_PROFILE_ID", watchProfile.id);
exportEnv("IOS_WATCH_PROVISIONING_PROFILE", watchProfileName);
