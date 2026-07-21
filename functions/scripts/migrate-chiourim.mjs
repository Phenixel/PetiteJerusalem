#!/usr/bin/env node
/**
 * Migration des chiourim : webhook n8n (Notion) -> Firestore + Cloud Storage.
 *
 * PRÉREQUIS
 *   cd functions && npm install                 # firebase-admin doit être présent
 *   gcloud auth application-default login        # compte AYANT accès à petite-jerusalem-dev
 *   gcloud config set project petite-jerusalem-dev
 *
 * USAGE
 *   node scripts/migrate-chiourim.mjs            # DRY-RUN : n'écrit RIEN, sort un rapport
 *   node scripts/migrate-chiourim.mjs --commit   # exécute : upload audio + écrit Firestore
 *
 * IMPORTANT
 *   Les URLs média Notion expirent ~1h. Lancer le --commit en UN seul passage.
 *   Le dry-run fonctionne même avant l'activation de Cloud Storage (il ne fait que
 *   lire le webhook et télécharger les fichiers en mémoire pour vérifier).
 */

import { createRequire } from "node:module";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

// --- Configuration --------------------------------------------------------
const PROJECT_ID = "petite-jerusalem-dev";
const STORAGE_BUCKET = "petite-jerusalem-dev.firebasestorage.app";
const CHIOURIM_URL =
  "https://n8n.phenixel.fr/webhook/1e7e1be1-1f2c-4916-a6f6-34ff8f437ef6";

const COMMIT = process.argv.includes("--commit");
// Mode rapport : classe les chiourim (avec/sans audio) SANS rien télécharger ni écrire.
const REPORT = process.argv.includes("--report");

// --- Helpers (alignés sur src/services/chiourService.ts) ------------------
function generateSlug(name) {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/'"“”‘’`?#]/g, "");
}

function parseMediaUrl(medias) {
  try {
    const parsed = JSON.parse(medias);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
  } catch {
    /* ignore */
  }
  return "";
}

function extFor(contentType, url) {
  const ct = contentType || "";
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3";
  if (ct.includes("mp4") || ct.includes("m4a") || ct.includes("aac")) return "m4a";
  if (ct.includes("wav")) return "wav";
  if (ct.includes("ogg")) return "ogg";
  const m = url.split("?")[0].match(/\.(mp3|m4a|wav|ogg|aac)$/i);
  return m ? m[1].toLowerCase() : "mp3";
}

// --- Migration ------------------------------------------------------------
async function main() {
  console.log(
    `\n=== Migration chiourim — mode ${COMMIT ? "COMMIT (écriture réelle)" : "DRY-RUN (aucune écriture)"} ===\n`,
  );

  admin.initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const res = await fetch(CHIOURIM_URL);
  if (!res.ok) throw new Error(`Webhook chiourim: HTTP ${res.status}`);
  const items = await res.json();
  console.log(`${items.length} chiourim reçus du webhook.\n`);

  const needAudio = []; // chiourim sans fichier audio (à re-sourcer)
  const failed = []; // échecs de téléchargement
  let done = 0;

  for (const item of items) {
    const name = item.name;
    const slug = generateSlug(name);
    const mediaUrl = parseMediaUrl(item.property_medias);
    const hasYouTube = !!item.property_link && /youtu/.test(item.property_link);

    const base = {
      slug,
      name,
      description: item.property_description || "",
      auteur: item.property_auteur ?? null,
      categories: item.property_cat_gorie || [],
      niveau: item.property_niveau ?? null,
    };

    // Mode rapport : on classe sans télécharger
    if (REPORT) {
      if (mediaUrl) {
        done += 1;
        console.log(`  ♪ ${name}`);
      } else {
        needAudio.push({ name, reason: hasYouTube ? "YouTube uniquement" : "aucun média" });
      }
      continue;
    }

    // Pas de fichier audio -> doc en brouillon, à compléter via l'admin
    if (!mediaUrl) {
      needAudio.push({ name, reason: hasYouTube ? "YouTube uniquement" : "aucun média" });
      if (COMMIT) {
        await db.collection("chiourim").doc(slug).set(
          {
            ...base,
            audioPath: "",
            mediaUrl: "",
            duration: null,
            fileSize: null,
            published: false, // invisible tant qu'il n'y a pas d'audio
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      continue;
    }

    // Téléchargement du fichier audio (URL Notion, expire ~1h)
    let buffer, contentType;
    try {
      const dl = await fetch(mediaUrl);
      if (!dl.ok) throw new Error(`HTTP ${dl.status}`);
      contentType = dl.headers.get("content-type") || "audio/mpeg";
      buffer = Buffer.from(await dl.arrayBuffer());
    } catch (err) {
      failed.push({ name, error: String(err) });
      console.warn(`  ⚠️  ${name} : téléchargement échoué (${err})`);
      continue;
    }

    const ext = extFor(contentType, mediaUrl);
    const audioPath = `chiourim/${slug}/audio.${ext}`;
    const token = crypto.randomUUID();
    const finalUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(
      audioPath,
    )}?alt=media&token=${token}`;

    if (COMMIT) {
      await bucket.file(audioPath).save(buffer, {
        resumable: false,
        metadata: {
          contentType: contentType.startsWith("audio/") ? contentType : "audio/mpeg",
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });
      await db.collection("chiourim").doc(slug).set(
        {
          ...base,
          audioPath,
          mediaUrl: finalUrl,
          duration: null,
          fileSize: buffer.length,
          published: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    done += 1;
    console.log(
      `  ✅ ${name} — ${(buffer.length / 1024 / 1024).toFixed(1)} Mo${COMMIT ? "" : " (simulé)"}`,
    );
  }

  // --- Rapport ------------------------------------------------------------
  console.log(`\n=== Rapport ===`);
  console.log(`Audio prêts à migrer : ${done}`);
  console.log(`À re-sourcer (sans audio) : ${needAudio.length}`);
  needAudio.forEach((c) => console.log(`   - ${c.name}  [${c.reason}]`));
  if (failed.length) {
    console.log(`Échecs de téléchargement : ${failed.length}`);
    failed.forEach((c) => console.log(`   - ${c.name}  (${c.error})`));
  }
  if (!COMMIT) {
    console.log(`\nDry-run terminé. Rien n'a été écrit. Relancer avec --commit pour exécuter.`);
  } else {
    console.log(`\nMigration terminée.`);
  }
}

main().catch((err) => {
  console.error("\nÉchec de la migration :", err);
  process.exit(1);
});
