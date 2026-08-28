#!/usr/bin/env node
/**
 * Envoie les captures d'écran de la fiche App Store depuis
 * store-assets/metadata/ios/screenshots/<locale>/ via l'API App Store Connect
 * (pendant iOS de l'envoi d'images de scripts/play-listing.mjs).
 *
 * L'API impose un envoi en trois temps par image : réservation (POST
 * appScreenshots avec nom et taille, qui répond des « upload operations »),
 * envoi des morceaux (PUT vers les URLs signées), puis validation (PATCH
 * uploaded=true avec la somme MD5). C'est ce cérémonial qui faisait des
 * captures le dernier geste manuel de la release iOS ; il est ici scripté et
 * joué par le job « screenshots » de deploy-ios.yml à chaque tag.
 *
 * Arborescence attendue (mêmes locales qu'App Store Connect : fr-FR, en-US,
 * he ; une locale sans dossier ou sans images laisse sa fiche intacte) :
 *   <locale>/iphone-*.jpg   famille iPhone 6,9" (1320×2868), APP_IPHONE_67
 *   <locale>/ipad-*.jpg     famille iPad 13" (2064×2752), APP_IPAD_PRO_3GEN_129
 *
 * Les fichiers sont produits par `npm run store:screenshots -- --ios` (JPEG
 * sRGB sans canal alpha, dimensions exactes) et envoyés triés par nom ; le
 * jeu existant de chaque famille est remplacé en entier, comme pour les
 * captures Play. Apple valide les images après l'envoi : le script attend ce
 * verdict et échoue si une image est refusée (mauvaises dimensions, alpha…).
 *
 * Usage :
 *   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_PRIVATE_KEY="$(cat AuthKey_XXX.p8)" \
 *     node scripts/asc-screenshots.mjs --version 3.8.1
 *
 * La version du tag doit être encore modifiable (PREPARE_FOR_SUBMISSION et
 * assimilés, elle vient d'être créée ou renommée par appstore-listing.mjs) ;
 * déjà soumise ou publiée (re-run d'un vieux tag), il n'y a rien à faire et
 * le script sort en 0.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createAscClient, EDITABLE_STATES, versionState } from "./lib/asc-api.mjs";

const BUNDLE_ID = "fr.petitejerusalem.app";
const screenshotsDir = join(import.meta.dirname, "../store-assets/metadata/ios/screenshots");

// Familles d'appareils : préfixe de fichier → displayType App Store Connect.
// APP_IPHONE_67 couvre les grands iPhone (6,7" et 6,9", 1290×2796 ou
// 1320×2868) ; APP_IPAD_PRO_3GEN_129 les grands iPad (12,9" et 13",
// 2048×2732 ou 2064×2752). Apple redimensionne pour les tailles plus petites.
const DISPLAY_TYPES = {
  iphone: "APP_IPHONE_67",
  ipad: "APP_IPAD_PRO_3GEN_129",
};

const versionArg = process.argv.indexOf("--version");
const wantedVersion = versionArg !== -1 ? process.argv[versionArg + 1] : null;
if (!wantedVersion) {
  console.error("asc-screenshots: --version est requis (ex. --version 3.8.1)");
  process.exit(1);
}

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privateKeyPem = process.env.ASC_PRIVATE_KEY;
if (!keyId || !issuerId || !privateKeyPem) {
  console.error(
    "asc-screenshots: ASC_KEY_ID, ASC_ISSUER_ID et ASC_PRIVATE_KEY sont requis, voir docs/ios-ci-cd.md",
  );
  process.exit(1);
}
const { api } = createAscClient({ keyId, issuerId, privateKeyPem });

// --- Inventaire local --------------------------------------------------------
function imageFiles(locale, family) {
  const dir = join(screenshotsDir, locale);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.startsWith(`${family}-`) && /\.(png|jpe?g)$/i.test(name))
    .sort()
    .map((name) => join(dir, name));
}

const locales = existsSync(screenshotsDir)
  ? readdirSync(screenshotsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((locale) => Object.keys(DISPLAY_TYPES).some((f) => imageFiles(locale, f).length > 0))
  : [];
if (locales.length === 0) {
  console.error(`asc-screenshots: aucune capture trouvée dans ${screenshotsDir}`);
  process.exit(1);
}

// --- Résolution de l'app et de la version ------------------------------------
const apps = await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
const app = apps.data[0];
if (!app) {
  console.error(`asc-screenshots: aucune app ${BUNDLE_ID} dans App Store Connect`);
  process.exit(1);
}

const versions = await api(
  "GET",
  `/v1/apps/${app.id}/appStoreVersions?filter[versionString]=${wantedVersion}&limit=5`,
);
const version = versions.data[0];
if (!version) {
  console.error(
    `asc-screenshots: aucune version ${wantedVersion} dans App Store Connect, ` +
      "l'étape « Mettre à jour la fiche App Store » du job iOS a dû échouer (elle la crée) ; corriger puis relancer.",
  );
  process.exit(1);
}
if (!EDITABLE_STATES.includes(versionState(version))) {
  // Re-run d'un tag déjà soumis, ou version déjà publiée : les captures ne
  // sont plus modifiables, et celles du store restent en place.
  console.log(
    `asc-screenshots: version ${wantedVersion} déjà soumise ou publiée (${versionState(version)}), captures inchangées.`,
  );
  process.exit(0);
}

const localizations = await api(
  "GET",
  `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`,
);

// --- Envoi -------------------------------------------------------------------

/** Joue les « upload operations » d'une réservation : le fichier par morceaux. */
async function uploadOperations(operations, buffer, fileName) {
  for (const op of operations) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const chunk = buffer.subarray(op.offset, op.offset + op.length);
    const response = await fetch(op.url, { method: op.method, headers, body: chunk });
    if (!response.ok) {
      throw new Error(`${fileName} : envoi du morceau à ${op.offset} → ${response.status}`);
    }
  }
}

/**
 * Attend le verdict d'Apple sur les images d'un jeu : la validation
 * (dimensions, absence d'alpha…) est asynchrone, un état FAILED après un
 * `uploaded=true` accepté est la seule trace d'une image refusée.
 */
async function waitForDelivery(ids, label) {
  const deadline = Date.now() + 3 * 60 * 1000;
  const pending = new Set(ids);
  while (pending.size > 0 && Date.now() < deadline) {
    for (const id of [...pending]) {
      const shot = await api("GET", `/v1/appScreenshots/${id}`);
      const delivery = shot.data.attributes.assetDeliveryState;
      if (delivery?.state === "FAILED") {
        const detail = (delivery.errors ?? []).map((e) => e.description ?? e.code).join(", ");
        throw new Error(`${label} : capture refusée par Apple (${detail || "sans détail"})`);
      }
      if (delivery == null || delivery.state === "COMPLETE") pending.delete(id);
    }
    if (pending.size > 0) await new Promise((r) => setTimeout(r, 5000));
  }
  if (pending.size > 0) {
    console.warn(`asc-screenshots: ${label}, validation toujours en cours après 3 min (non bloquant)`);
  }
}

for (const locale of locales) {
  const localization = localizations.data.find((l) => l.attributes.locale === locale);
  if (!localization) {
    console.warn(
      `asc-screenshots: pas de localisation ${locale} sur la version ${wantedVersion} ` +
        "(appstore-listing.mjs la crée), captures de cette langue non envoyées",
    );
    continue;
  }

  const sets = await api(
    "GET",
    `/v1/appStoreVersionLocalizations/${localization.id}/appScreenshotSets?limit=50`,
  );

  for (const [family, displayType] of Object.entries(DISPLAY_TYPES)) {
    const files = imageFiles(locale, family);
    if (files.length === 0) continue;

    let set = sets.data.find((s) => s.attributes.screenshotDisplayType === displayType);
    if (!set) {
      set = await api("POST", "/v1/appScreenshotSets", {
        data: {
          type: "appScreenshotSets",
          attributes: { screenshotDisplayType: displayType },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: "appStoreVersionLocalizations", id: localization.id },
            },
          },
        },
      }).then((r) => r.data);
    }

    // Remplacement du jeu entier, comme les captures Play : l'ordre et le
    // contenu du store sont exactement ceux du repo.
    const existing = await api("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
    for (const shot of existing.data) {
      await api("DELETE", `/v1/appScreenshots/${shot.id}`);
    }

    const uploadedIds = [];
    for (const file of files) {
      const buffer = readFileSync(file);
      const fileName = file.split("/").pop();
      const reservation = await api("POST", "/v1/appScreenshots", {
        data: {
          type: "appScreenshots",
          attributes: { fileName, fileSize: buffer.length },
          relationships: {
            appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } },
          },
        },
      }).then((r) => r.data);

      await uploadOperations(reservation.attributes.uploadOperations ?? [], buffer, fileName);

      await api("PATCH", `/v1/appScreenshots/${reservation.id}`, {
        data: {
          type: "appScreenshots",
          id: reservation.id,
          attributes: {
            uploaded: true,
            sourceFileChecksum: createHash("md5").update(buffer).digest("hex"),
          },
        },
      });
      uploadedIds.push(reservation.id);
      console.log(`asc-screenshots: ${locale}/${fileName} envoyé`);
    }

    // L'ordre d'affichage est celui de la relation, réécrite explicitement
    // plutôt que déduite de l'ordre d'insertion.
    await api("PATCH", `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, {
      data: uploadedIds.map((id) => ({ type: "appScreenshots", id })),
    });

    await waitForDelivery(uploadedIds, `${locale}/${family}`);
    console.log(
      `asc-screenshots: jeu ${displayType} remplacé (${files.length} captures, ${locale})`,
    );
  }
}

console.log(`asc-screenshots: captures de la version ${wantedVersion} publiées`);
