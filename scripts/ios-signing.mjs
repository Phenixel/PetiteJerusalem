#!/usr/bin/env node
/**
 * Signature iOS en CI : fabrique un certificat de distribution et un profil
 * « App Store » ÉPHÉMÈRES via l'API App Store Connect, les installe sur le
 * runner, et les détruit en fin de run.
 *
 * Pourquoi ne pas laisser xcodebuild signer tout seul (-allowProvisioningUpdates) :
 * `xcodebuild archive` en signature AUTOMATIQUE réclame un profil de
 * *développement* (« No profiles for 'fr.petitejerusalem.app' were found:
 * Xcode couldn't find any iOS App Development provisioning profiles »), et un
 * profil de développement exige au moins un appareil enregistré dans l'équipe.
 * Le compte est un compte individuel sans appareil : impasse. Forcer
 * CODE_SIGN_IDENTITY="Apple Distribution" par-dessus le mode automatique ne
 * marche pas non plus — Xcode refuse le mélange (« has conflicting
 * provisioning settings ») sur la cible App *et* sur chaque paquet SPM.
 *
 * D'où la signature MANUELLE : un profil « App Store » n'a besoin d'aucun
 * appareil. Le certificat est créé pour le run puis révoqué (même principe
 * qu'Xcode Cloud) — les binaires déjà envoyés n'en souffrent pas, Apple
 * re-signe tout ce qui passe par TestFlight et l'App Store.
 *
 * Rien n'est stocké dans le repo : ni .p12, ni profil, ni mot de passe.
 *
 * Usage :
 *   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_PRIVATE_KEY=… IOS_DEVELOPMENT_TEAM=… \
 *     node scripts/ios-signing.mjs --setup
 *   … node scripts/ios-signing.mjs --cleanup     (idempotent, ne casse jamais le run)
 *
 * --setup écrit dans $GITHUB_ENV (lues ensuite par scripts/setup-ios.mjs et
 * par l'export de l'IPA) :
 *   IOS_PROVISIONING_PROFILE     nom du profil (PROVISIONING_PROFILE_SPECIFIER)
 *   IOS_CODE_SIGN_IDENTITY       nom complet de l'identité de signature
 *   IOS_SIGNING_CERTIFICATE_ID   id ASC du certificat, pour --cleanup
 *   IOS_SIGNING_PROFILE_ID       id ASC du profil, pour --cleanup
 *   IOS_SIGNING_KEYCHAIN         trousseau temporaire, pour --cleanup
 */
import { execFileSync } from "node:child_process";
import { createPrivateKey, randomBytes, sign as cryptoSign } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const BUNDLE_ID = "fr.petitejerusalem.app";
// Préfixe reconnaissable : --setup fait le ménage des profils laissés par un
// run interrompu avant son étape de nettoyage.
const PROFILE_PREFIX = "PetiteJerusalem CI";
// Capacités que le profil doit couvrir, sous peine d'échec de signature
// (« doesn't match the entitlements file »). En signature automatique, Xcode
// les activait lui-même sur l'App ID ; en manuel, c'est à nous.
// L'App Group des widgets n'y est pas : l'API App Store Connect ne sait pas
// créer de groupe, et les widgets ne sont pas dans la v1 (docs/app-widgets.md).
const CAPABILITIES = ["PUSH_NOTIFICATIONS", "APPLE_ID_AUTH"];

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
    const detail = json?.errors?.map((e) => `${e.title} — ${e.detail}`).join("\n  ") ?? text;
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
// Nettoyage : révoque le certificat, supprime le profil et le trousseau.
// ---------------------------------------------------------------------------
if (isCleanup) {
  const certificateId = process.env.IOS_SIGNING_CERTIFICATE_ID;
  const profileId = process.env.IOS_SIGNING_PROFILE_ID;
  for (const [label, path] of [
    ["profil", profileId && `/v1/profiles/${profileId}`],
    ["certificat", certificateId && `/v1/certificates/${certificateId}`],
  ]) {
    if (!path) continue;
    try {
      await api("DELETE", path);
      console.log(`ios-signing: ${label} supprimé côté Apple`);
    } catch (error) {
      // Un nettoyage raté ne doit pas masquer le résultat du run : le pire cas
      // est un certificat de trop, révocable à la main sur developer.apple.com.
      console.warn(`ios-signing: ⚠️ ${label} non supprimé — ${error.message}`);
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
const bundleIds = await api(
  "GET",
  `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=200`,
);
// filter[identifier] est un « contains » côté Apple : on exige l'égalité.
const bundleIdRecord = bundleIds.data.find((entry) => entry.attributes.identifier === BUNDLE_ID);
if (!bundleIdRecord) {
  console.error(
    `ios-signing: aucun App ID « ${BUNDLE_ID} » dans le compte développeur.\n` +
      "  Le créer sur developer.apple.com → Certificates, Identifiers & Profiles → Identifiers.",
  );
  process.exit(1);
}
console.log(`ios-signing: App ID ${BUNDLE_ID} (${bundleIdRecord.id})`);

for (const capabilityType of CAPABILITIES) {
  try {
    await api("POST", "/v1/bundleIdCapabilities", {
      data: {
        type: "bundleIdCapabilities",
        attributes: { capabilityType },
        relationships: { bundleId: { data: { type: "bundleIds", id: bundleIdRecord.id } } },
      },
    });
    console.log(`ios-signing: capacité ${capabilityType} activée`);
  } catch (error) {
    // 409 = déjà activée : c'est le cas nominal des runs suivants.
    if (error.status === 409) console.log(`ios-signing: capacité ${capabilityType} déjà active`);
    else throw error;
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
    const existing = await api("GET", "/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=200")
      .then((r) => r.data)
      .catch(() => []);
    console.error(
      `ios-signing: Apple refuse de créer un certificat de distribution — ${error.message}\n` +
        `  ${existing.length} certificat(s) de distribution existent déjà (le quota est de 3) :\n` +
        existing
          .map((c) => `    ${c.id}  ${c.attributes.displayName ?? "?"}  expire le ${c.attributes.expirationDate ?? "?"}`)
          .join("\n") +
        "\n  En révoquer un sur developer.apple.com → Certificates, puis relancer.",
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
  console.warn("ios-signing: ⚠️ autorité WWDR non téléchargée — on continue (elle est fournie par l'image macOS)");
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
console.log(`ios-signing: identité installée — ${identity}`);

// ---------------------------------------------------------------------------
// 4. Profil de provisionnement App Store
// ---------------------------------------------------------------------------
// Les profils d'un run précédent tué avant son nettoyage encombrent le compte
// et bloquent la réutilisation du nom : on les supprime.
const staleProfiles = await api("GET", "/v1/profiles?limit=200")
  .then((r) => r.data.filter((p) => p.attributes.name?.startsWith(PROFILE_PREFIX)))
  .catch(() => []);
for (const stale of staleProfiles) {
  await api("DELETE", `/v1/profiles/${stale.id}`).catch(() => {});
  console.log(`ios-signing: ancien profil « ${stale.attributes.name} » supprimé`);
}

const profileName = `${PROFILE_PREFIX} ${process.env.GITHUB_RUN_ID ?? Date.now()}`;
const profile = await api("POST", "/v1/profiles", {
  data: {
    type: "profiles",
    attributes: { name: profileName, profileType: "IOS_APP_STORE" },
    relationships: {
      bundleId: { data: { type: "bundleIds", id: bundleIdRecord.id } },
      certificates: { data: [{ type: "certificates", id: certificateId }] },
    },
  },
});
exportEnv("IOS_SIGNING_PROFILE_ID", profile.data.id);
exportEnv("IOS_PROVISIONING_PROFILE", profileName);

const profileContent = Buffer.from(profile.data.attributes.profileContent, "base64");
const uuid = profile.data.attributes.uuid;
// Xcode 16+ lit le second dossier ; les outils en ligne de commande plus
// anciens lisent le premier. Les deux coûtent un fichier.
for (const dir of [
  join(homedir(), "Library/MobileDevice/Provisioning Profiles"),
  join(homedir(), "Library/Developer/Xcode/UserData/Provisioning Profiles"),
]) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${uuid}.mobileprovision`), profileContent);
}
console.log(`ios-signing: profil « ${profileName} » installé (${uuid})`);
