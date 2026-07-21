#!/usr/bin/env node
/**
 * Met à jour la fiche Play Store (descriptions + images) depuis
 * store-assets/metadata/android/<locale>/ via l'API Android Publisher.
 *
 * Arborescence attendue (format fastlane, un dossier par langue Play Store :
 * fr-FR, en-US, iw-IL — Google utilise encore « iw » pour l'hébreu) :
 *   <locale>/title.txt                    (≤ 30 caractères)
 *   <locale>/short_description.txt        (≤ 80)
 *   <locale>/full_description.txt         (≤ 4000)
 *   <locale>/changelogs/default.txt       (≤ 500, notes de version — lues par
 *                                          la CI pour whatsNewDirectory, pas ici)
 *   <locale>/images/phoneScreenshots/*.png|jpg  (remplacées seulement si ≥ 2,
 *                                          le minimum exigé par la Play Console)
 *   <locale>/images/featureGraphic.png    (bannière 1024×500, optionnelle)
 *
 * Usage :
 *   node scripts/play-listing.mjs --check   vérifie les limites de caractères
 *                                           (aucun accès réseau)
 *   PLAY_SERVICE_ACCOUNT_JSON='{"...":...}' node scripts/play-listing.mjs
 *                                           publie la fiche sur le Play Store
 */
import { createReadStream, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_NAME = "fr.petitejerusalem.app";
const metadataDir = join(import.meta.dirname, "../store-assets/metadata/android");

// Les limites de la Play Console comptent les caractères Unicode (code points),
// pas les octets — important pour l'hébreu et les émojis.
const LIMITS = {
  "title.txt": 30,
  "short_description.txt": 80,
  "full_description.txt": 4000,
  "changelogs/default.txt": 500,
};

const locales = readdirSync(metadataDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (locales.length === 0) {
  console.error(`play-listing: aucune langue trouvée dans ${metadataDir}`);
  process.exit(1);
}

function readText(locale, relPath) {
  return readFileSync(join(metadataDir, locale, relPath), "utf8").trim();
}

function screenshotFiles(locale) {
  const dir = join(metadataDir, locale, "images/phoneScreenshots");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort()
    .map((name) => join(dir, name));
}

// --- Validation des limites (toujours exécutée, seul mode si --check) ---
let errors = 0;
for (const locale of locales) {
  for (const [relPath, limit] of Object.entries(LIMITS)) {
    const filePath = join(metadataDir, locale, relPath);
    if (!existsSync(filePath)) {
      console.error(`play-listing: fichier manquant — ${locale}/${relPath}`);
      errors++;
      continue;
    }
    const length = [...readText(locale, relPath)].length;
    if (length > limit) {
      console.error(`play-listing: ${locale}/${relPath} fait ${length} caractères (max ${limit})`);
      errors++;
    } else {
      console.log(`play-listing: ${locale}/${relPath} — ${length}/${limit} caractères`);
    }
  }
  const shots = screenshotFiles(locale);
  if (shots.length === 1) {
    console.warn(
      `play-listing: ${locale} n'a qu'une capture d'écran — la Play Console en exige au moins 2, elles ne seront pas envoyées`,
    );
  }
}
if (errors > 0) process.exit(1);
if (process.argv.includes("--check")) {
  console.log("play-listing: vérification OK");
  process.exit(0);
}

// --- Publication ---
const serviceAccountJson = process.env.PLAY_SERVICE_ACCOUNT_JSON;
if (!serviceAccountJson) {
  console.error("play-listing: variable PLAY_SERVICE_ACCOUNT_JSON absente");
  process.exit(1);
}

const { androidpublisher } = await import("@googleapis/androidpublisher");
const { GoogleAuth } = await import("google-auth-library");

const auth = new GoogleAuth({
  credentials: JSON.parse(serviceAccountJson),
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});
const play = androidpublisher({ version: "v3", auth });

const edit = await play.edits.insert({ packageName: PACKAGE_NAME });
const editId = edit.data.id;

for (const locale of locales) {
  await play.edits.listings.update({
    packageName: PACKAGE_NAME,
    editId,
    language: locale,
    requestBody: {
      language: locale,
      title: readText(locale, "title.txt"),
      shortDescription: readText(locale, "short_description.txt"),
      fullDescription: readText(locale, "full_description.txt"),
    },
  });
  console.log(`play-listing: fiche ${locale} mise à jour`);

  const shots = screenshotFiles(locale);
  if (shots.length >= 2) {
    await play.edits.images.deleteall({
      packageName: PACKAGE_NAME,
      editId,
      language: locale,
      imageType: "phoneScreenshots",
    });
    for (const shot of shots) {
      await play.edits.images.upload({
        packageName: PACKAGE_NAME,
        editId,
        language: locale,
        imageType: "phoneScreenshots",
        media: {
          mimeType: shot.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
          body: createReadStream(shot),
        },
      });
    }
    console.log(`play-listing: ${shots.length} captures d'écran envoyées (${locale})`);
  }

  const featureGraphic = join(metadataDir, locale, "images/featureGraphic.png");
  if (existsSync(featureGraphic)) {
    await play.edits.images.deleteall({
      packageName: PACKAGE_NAME,
      editId,
      language: locale,
      imageType: "featureGraphic",
    });
    await play.edits.images.upload({
      packageName: PACKAGE_NAME,
      editId,
      language: locale,
      imageType: "featureGraphic",
      media: { mimeType: "image/png", body: createReadStream(featureGraphic) },
    });
    console.log(`play-listing: bannière (feature graphic) envoyée (${locale})`);
  }
}

await play.edits.commit({ packageName: PACKAGE_NAME, editId });
console.log("play-listing: fiche Play Store publiée");
