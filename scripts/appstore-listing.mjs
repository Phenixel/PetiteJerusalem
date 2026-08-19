#!/usr/bin/env node
/**
 * Met à jour la fiche App Store depuis store-assets/metadata/ios/<locale>/
 * via l'API App Store Connect (pendant iOS de scripts/play-listing.mjs).
 *
 * Arborescence attendue (un dossier par langue App Store Connect :
 * fr-FR, en-US, he) :
 *   <locale>/name.txt              (≤ 30 caractères)
 *   <locale>/subtitle.txt          (≤ 30)
 *   <locale>/keywords.txt          (≤ 100, séparés par des virgules sans espace)
 *   <locale>/promotional_text.txt  (≤ 170, modifiable sans nouvelle version)
 *   <locale>/description.txt       (≤ 4000)
 *   <locale>/support_url.txt       (obligatoire)
 *   <locale>/marketing_url.txt     (optionnel)
 *   <locale>/privacy_url.txt       (obligatoire, identique pour toutes les langues)
 *
 * Les captures d'écran ne sont **pas** envoyées par ce script (l'API impose un
 * upload en plusieurs morceaux avec somme de contrôle) : elles se déposent à la
 * main dans App Store Connect, une seule fois, voir docs/ios-ci-cd.md.
 *
 * Les notes de version (« Nouveautés ») ne viennent pas d'un fichier du repo :
 * la CI passe le corps de la release GitHub du tag via --release-notes, et à
 * défaut c'est la phrase par défaut de scripts/release-notes.mjs qui part
 * même logique que le Play Store (scripts/prepare-whatsnew.mjs). Le corps,
 * rédigé en français, n'alimente que fr-FR ; les autres langues reçoivent la
 * phrase par défaut. Apple refuse `whatsNew` sur la toute première version :
 * le script réessaie alors sans.
 *
 * Usage :
 *   node scripts/appstore-listing.mjs --check     vérifie limites et caractères
 *                                                 (aucun réseau)
 *   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_PRIVATE_KEY="$(cat AuthKey_XXX.p8)" \
 *     node scripts/appstore-listing.mjs [--version 3.6.4] [--release-notes body.md]
 *
 * Sans --version, le script prend la version App Store à l'état
 * « modifiable » (PREPARE_FOR_SUBMISSION et assimilés).
 */
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defaultReleaseNotes, markdownToPlain, releaseBodyApplies } from "./release-notes.mjs";

const BUNDLE_ID = "fr.petitejerusalem.app";
const metadataDir = join(import.meta.dirname, "../store-assets/metadata/ios");

// Les limites d'App Store Connect comptent les caractères Unicode (code
// points), pas les octets, important pour l'hébreu et les émojis.
const LIMITS = {
  "name.txt": 30,
  "subtitle.txt": 30,
  "keywords.txt": 100,
  "promotional_text.txt": 170,
  "description.txt": 4000,
};

// App Store Connect rejette les émojis et assimilés (« Ce champ contient un ou
// plusieurs caractères non valides ») : tout ce qui est hors BMP (émojis
// proprement dits), plus les blocs symboliques du BMP rendus en émoji
// (⌚ ⏰ ☀ ✅ ⭐…) et les caractères de composition d'émojis. Détecté ici pour
// planter au --check du début de workflow, pas après 40 minutes de build.
const FORBIDDEN_CHARS =
  /[\u{10000}-\u{10FFFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu;
// promotional_text.txt et marketing_url.txt sont facultatifs côté Apple.
const OPTIONAL = new Set(["promotional_text.txt", "marketing_url.txt"]);
const REQUIRED = [...Object.keys(LIMITS), "support_url.txt", "privacy_url.txt"].filter(
  (file) => !OPTIONAL.has(file),
);

const locales = readdirSync(metadataDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "screenshots")
  .map((entry) => entry.name);

if (locales.length === 0) {
  console.error(`appstore-listing: aucune langue trouvée dans ${metadataDir}`);
  process.exit(1);
}

const read = (locale, file) => readFileSync(join(metadataDir, locale, file), "utf8").trim();
const readIfExists = (locale, file) =>
  existsSync(join(metadataDir, locale, file)) ? read(locale, file) : null;

// --- Validation des limites (toujours exécutée, seul mode si --check) --------
let errors = 0;
for (const locale of locales) {
  for (const file of REQUIRED) {
    if (existsSync(join(metadataDir, locale, file))) continue;
    console.error(`appstore-listing: fichier manquant, ${locale}/${file}`);
    errors++;
  }
  for (const [file, limit] of Object.entries(LIMITS)) {
    if (!existsSync(join(metadataDir, locale, file))) continue;
    const length = [...read(locale, file)].length;
    if (length > limit) {
      console.error(`appstore-listing: ${locale}/${file} fait ${length} caractères (max ${limit})`);
      errors++;
    } else {
      console.log(`appstore-listing: ${locale}/${file}, ${length}/${limit} caractères`);
    }
  }
  // Apple rejette les mots-clés séparés par « , » avec espace : chaque espace
  // perdu est un caractère de moins pour un mot-clé utile.
  if (existsSync(join(metadataDir, locale, "keywords.txt")) && read(locale, "keywords.txt").includes(", ")) {
    console.error(`appstore-listing: ${locale}/keywords.txt contient « , », séparer par des virgules sans espace`);
    errors++;
  }
  // Caractères refusés par l'API App Store Connect (émojis…).
  for (const file of new Set([...Object.keys(LIMITS), ...REQUIRED])) {
    if (!existsSync(join(metadataDir, locale, file))) continue;
    const lines = readFileSync(join(metadataDir, locale, file), "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const match of line.matchAll(FORBIDDEN_CHARS)) {
        const codePoint = match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
        console.error(
          `appstore-listing: ${locale}/${file}:${index + 1}, caractère refusé par App Store Connect : « ${match[0]} » (U+${codePoint})`,
        );
        errors++;
      }
    });
  }
}
if (errors > 0) process.exit(1);
if (process.argv.includes("--check")) {
  console.log("appstore-listing: vérification OK");
  process.exit(0);
}

// --- Authentification App Store Connect (JWT ES256) -------------------------
const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privateKeyPem = process.env.ASC_PRIVATE_KEY;
if (!keyId || !issuerId || !privateKeyPem) {
  console.error(
    "appstore-listing: ASC_KEY_ID, ASC_ISSUER_ID et ASC_PRIVATE_KEY sont requis, voir docs/ios-ci-cd.md",
  );
  process.exit(1);
}

const base64url = (input) =>
  Buffer.from(input).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

function appStoreConnectToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  // 20 minutes : la durée maximale acceptée par Apple.
  const payload = { iss: issuerId, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // JOSE attend la signature ECDSA au format brut R||S, pas le DER d'OpenSSL.
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(privateKeyPem.replaceAll("\\n", "\n")),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64url(signature)}`;
}

const token = appStoreConnectToken();

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

// --- Résolution de l'app et de la version ------------------------------------
const apps = await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
const app = apps.data[0];
if (!app) {
  console.error(
    `appstore-listing: aucune app ${BUNDLE_ID} dans App Store Connect, la créer d'abord (voir docs/ios-release-plan.md).`,
  );
  process.exit(1);
}
console.log(`appstore-listing: app ${BUNDLE_ID} trouvée (${app.id})`);

const versionArg = process.argv.indexOf("--version");
const wantedVersion = versionArg !== -1 ? process.argv[versionArg + 1] : null;

// --- Notes de version : release GitHub (fr-FR) ou phrase par défaut ----------
const WHATS_NEW_LIMIT = 4000;
const notesArg = process.argv.indexOf("--release-notes");
const notesFile = notesArg !== -1 ? process.argv[notesArg + 1] : null;
const releaseBody =
  notesFile && existsSync(notesFile) ? markdownToPlain(readFileSync(notesFile, "utf8")) : "";
function whatsNewFor(locale) {
  if (releaseBody && releaseBodyApplies(locale)) {
    const chars = [...releaseBody];
    if (chars.length <= WHATS_NEW_LIMIT) return releaseBody;
    console.warn(
      `appstore-listing: notes de la release GitHub tronquées à ${WHATS_NEW_LIMIT} caractères (${chars.length})`,
    );
    return `${chars.slice(0, WHATS_NEW_LIMIT - 1).join("").trimEnd()}…`;
  }
  return defaultReleaseNotes(locale);
}
console.log(
  releaseBody
    ? "appstore-listing: notes de version prises depuis la release GitHub (fr-FR), phrase par défaut ailleurs"
    : "appstore-listing: pas de texte de release GitHub, notes de version = phrase par défaut",
);
// États dans lesquels les textes d'une version sont encore modifiables.
// (WAITING_FOR_REVIEW n'en fait pas partie : l'API répond 409 STATE_ERROR.)
const EDITABLE_STATES = [
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "INVALID_BINARY",
];
// `appStoreState` est déprécié depuis l'API 3.3 au profit d'`appVersionState`.
const versionState = (v) => v.attributes.appVersionState ?? v.attributes.appStoreState;
const versions = await api("GET", `/v1/apps/${app.id}/appStoreVersions?limit=20`);
// Tri côté client (plus récente d'abord) : plusieurs versions peuvent être
// modifiables, dont d'anciennes rejetées.
const editable = versions.data
  .slice()
  .sort((a, b) => (b.attributes.createdDate ?? "").localeCompare(a.attributes.createdDate ?? ""))
  .filter((v) => EDITABLE_STATES.includes(versionState(v)));

// La version App Store est un objet distinct du build : Apple ne la crée ni ne
// la renomme quand un binaire arrive. Sans ce qui suit, chaque tag exigeait de
// renommer la version à la main (1.0 → 3.7.0 → 3.7.1…) sous peine de voir la
// synchro de la fiche s'arrêter sur « aucune version modifiable ». Le tag
// redevient donc la source unique de vérité, comme pour Android :
//   1. la version demandée existe et est modifiable → on l'utilise ;
//   2. une autre version est modifiable → on la renomme ;
//   3. aucune → on la crée.
// Les versions en examen ou publiées ne sont jamais touchées : elles ne sont
// pas dans EDITABLE_STATES.
let version = wantedVersion
  ? editable.find((v) => v.attributes.versionString === wantedVersion)
  : editable[0];

if (!version && wantedVersion) {
  const renamable = editable[0];
  if (renamable) {
    version = await api("PATCH", `/v1/appStoreVersions/${renamable.id}`, {
      data: {
        type: "appStoreVersions",
        id: renamable.id,
        attributes: { versionString: wantedVersion },
      },
    }).then((r) => r.data);
    console.log(
      `appstore-listing: version ${renamable.attributes.versionString} renommée en ${wantedVersion}`,
    );
  } else {
    version = await api("POST", "/v1/appStoreVersions", {
      data: {
        type: "appStoreVersions",
        attributes: {
          versionString: wantedVersion,
          platform: "IOS",
          // Publication manuelle : la mise en vente reste un geste délibéré
          // après l'accord d'Apple. Posé à la création seulement, un choix
          // fait ensuite dans App Store Connect n'est jamais réécrit.
          releaseType: "MANUAL",
        },
        relationships: { app: { data: { type: "apps", id: app.id } } },
      },
    }).then((r) => r.data);
    console.log(`appstore-listing: version ${wantedVersion} créée`);
  }
}

if (!version) {
  console.error(
    "appstore-listing: aucune version modifiable trouvée" +
      (wantedVersion ? ` pour ${wantedVersion}` : "") +
      ", créer la version dans App Store Connect (ou attendre que le build soit traité).",
  );
  process.exit(1);
}
console.log(`appstore-listing: version ${version.attributes.versionString} (${versionState(version)})`);

// --- Informations d'app (nom, sous-titre, confidentialité) -------------------
// Elles vivent sur l'« appInfo » modifiable, pas sur la version.
// Là aussi, `appStoreState` est déprécié au profit de `state`, dont les
// valeurs diffèrent (READY_FOR_DISTRIBUTION au lieu de READY_FOR_SALE).
const PUBLISHED_STATES = ["READY_FOR_SALE", "READY_FOR_DISTRIBUTION"];
const appInfos = await api("GET", `/v1/apps/${app.id}/appInfos`);
const appInfo =
  appInfos.data.find(
    (info) => !PUBLISHED_STATES.includes(info.attributes.state ?? info.attributes.appStoreState),
  ) ?? appInfos.data[0];
const infoLocalizations = await api("GET", `/v1/appInfos/${appInfo.id}/appInfoLocalizations?limit=50`);

const versionLocalizations = await api(
  "GET",
  `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`,
);

/**
 * Écrit une localisation : PATCH quand la liste lue plus haut la connaît, POST
 * sinon, et si Apple répond « already exists » (une fiche remplie à la main
 * n'apparaît pas toujours dans la liste au moment où on la lit), on relit et
 * on bascule sur un PATCH plutôt que d'abandonner.
 */
async function writeLocalization({ collection, type, locale, attributes, relationships, listPath, known }) {
  if (known) {
    return api("PATCH", `/v1/${collection}/${known.id}`, {
      data: { type, id: known.id, attributes },
    });
  }
  try {
    return await api("POST", `/v1/${collection}`, {
      data: { type, attributes: { locale, ...attributes }, relationships },
    });
  } catch (error) {
    const duplicate = error.status === 409 && /already exists/i.test(JSON.stringify(error.body ?? ""));
    if (!duplicate) throw error;
    const fresh = await api("GET", listPath);
    const existing = fresh.data.find((l) => l.attributes.locale === locale);
    if (!existing) {
      const seen = fresh.data.map((l) => l.attributes.locale).join(", ") || "aucune";
      throw new Error(
        `${collection} : Apple refuse « ${locale} » comme doublon mais ne le renvoie pas (locales listées : ${seen})`,
      );
    }
    return api("PATCH", `/v1/${collection}/${existing.id}`, {
      data: { type, id: existing.id, attributes },
    });
  }
}

// Une langue en échec ne doit pas emporter les suivantes : chacune est tentée,
// et le bilan est fait à la fin.
const failures = [];
for (const locale of locales) {
  try {
    // 1. Nom, sous-titre, URL de politique de confidentialité.
    await writeLocalization({
      collection: "appInfoLocalizations",
      type: "appInfoLocalizations",
      locale,
      attributes: {
        name: read(locale, "name.txt"),
        subtitle: read(locale, "subtitle.txt"),
        privacyPolicyUrl: read(locale, "privacy_url.txt"),
      },
      relationships: { appInfo: { data: { type: "appInfos", id: appInfo.id } } },
      listPath: `/v1/appInfos/${appInfo.id}/appInfoLocalizations?limit=50`,
      known: infoLocalizations.data.find((l) => l.attributes.locale === locale),
    });

    // 2. Description, mots-clés, texte promotionnel, nouveautés, URLs.
    const versionAttributes = {
      description: read(locale, "description.txt"),
      keywords: read(locale, "keywords.txt"),
      promotionalText: readIfExists(locale, "promotional_text.txt") ?? undefined,
      supportUrl: read(locale, "support_url.txt"),
      marketingUrl: readIfExists(locale, "marketing_url.txt") ?? undefined,
      whatsNew: whatsNewFor(locale),
    };

    /** Apple refuse `whatsNew` sur la toute première version : on réessaie sans. */
    async function pushVersionLocalization(attributes) {
      try {
        await writeLocalization({
          collection: "appStoreVersionLocalizations",
          type: "appStoreVersionLocalizations",
          locale,
          attributes,
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
          },
          listPath: `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`,
          known: versionLocalizations.data.find((l) => l.attributes.locale === locale),
        });
      } catch (error) {
        const isWhatsNewRejected =
          attributes.whatsNew !== undefined && JSON.stringify(error.body ?? "").includes("whatsNew");
        if (!isWhatsNewRejected) throw error;
        console.warn(
          `appstore-listing: ${locale}, « Nouveautés » refusé (première version de l'app), envoi sans.`,
        );
        await pushVersionLocalization({ ...attributes, whatsNew: undefined });
      }
    }
    await pushVersionLocalization(versionAttributes);

    console.log(`appstore-listing: fiche ${locale} mise à jour`);
  } catch (error) {
    failures.push(locale);
    console.error(`appstore-listing: échec pour ${locale}\n  ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(`appstore-listing: fiche NON synchronisée pour ${failures.join(", ")}`);
  process.exit(1);
}
console.log("appstore-listing: fiche App Store publiée");
