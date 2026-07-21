/**
 * Studio auteurs : callables d'ingestion des chiourim déposés via un lien
 * secret (/studio/:token), sans compte Firebase Auth.
 *
 * Flux : le client uploade l'audio en direct vers la zone de staging
 * `studioUploads/{token}/{uuid}.{ext}` (autorisée par une règle Storage
 * cross-service qui valide le token dans Firestore), puis appelle
 * `studioSubmitChiour` avec les seules métadonnées. Ici, côté serveur :
 * on revalide le token, on déplace le fichier (move, pas de re-transfert)
 * vers `chiourim/{slug}/audio.{ext}` (chemin public SANS le token), on pose
 * un token de download permanent et on crée le doc Firestore en brouillon
 * (`published: false`) : seul l'admin publie.
 *
 * Un auteur ne peut modifier/supprimer que SES chiourim (auteurId issu du
 * token) et uniquement tant qu'ils sont en brouillon.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";

// Même logique de slug que src/services/chiourService.ts (et que la migration).
function generateSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/'"“”‘’`?#]/g, "");
}

const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "ogg", "aac"];

// Bucket explicite (même valeur que le client et que la migration) : le
// bucket "par défaut" résolu par firebase-admin peut différer (ancien suffixe
// .appspot.com), notamment sous l'émulateur.
const STORAGE_BUCKET = "petite-jerusalem-dev.firebasestorage.app";

function bucket() {
  return getStorage().bucket(STORAGE_BUCKET);
}

type StudioAuthor = { auteurId: string; auteurName: string };

type ChiourMetadata = {
  name: string;
  description: string;
  categories: string[];
  niveau: string | null;
  serieId: string | null;
  newSerieName: string | null;
  episode: number | null;
  duration: number | null;
};

/** Valide le token de studio et renvoie l'auteur associé. */
async function requireAuthor(token: unknown): Promise<StudioAuthor> {
  if (typeof token !== "string" || token.length < 16 || token.length > 128) {
    throw new HttpsError("permission-denied", "Lien invalide.");
  }
  const snap = await getFirestore().collection("studioTokens").doc(token).get();
  const data = snap.data();
  if (!snap.exists || data?.active !== true) {
    throw new HttpsError("permission-denied", "Lien invalide ou révoqué.");
  }
  return { auteurId: data.auteurId as string, auteurName: data.auteurName as string };
}

function asTrimmedString(value: unknown, field: string, max: number, required = false): string {
  if (value == null) {
    if (required) throw new HttpsError("invalid-argument", `Champ requis : ${field}.`);
    return "";
  }
  if (typeof value !== "string" || value.length > max) {
    throw new HttpsError("invalid-argument", `Champ invalide : ${field}.`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new HttpsError("invalid-argument", `Champ requis : ${field}.`);
  }
  return trimmed;
}

/** Valide et normalise les métadonnées communes submit/update. */
function parseMetadata(data: Record<string, unknown>): ChiourMetadata {
  const name = asTrimmedString(data.name, "name", 200, true);
  const description = asTrimmedString(data.description, "description", 5000);
  const niveau = asTrimmedString(data.niveau, "niveau", 50) || null;
  const newSerieName = asTrimmedString(data.newSerieName, "newSerieName", 200) || null;
  const serieId = asTrimmedString(data.serieId, "serieId", 300) || null;

  const rawCategories = data.categories ?? [];
  if (!Array.isArray(rawCategories) || rawCategories.length > 10) {
    throw new HttpsError("invalid-argument", "Champ invalide : categories.");
  }
  const categories = rawCategories.map((c) => {
    if (typeof c !== "string" || !c.trim() || c.length > 60) {
      throw new HttpsError("invalid-argument", "Champ invalide : categories.");
    }
    return c.trim();
  });

  let episode: number | null = null;
  if (data.episode != null) {
    if (typeof data.episode !== "number" || !Number.isInteger(data.episode) || data.episode < 1 || data.episode > 10000) {
      throw new HttpsError("invalid-argument", "Champ invalide : episode.");
    }
    episode = data.episode;
  }

  let duration: number | null = null;
  if (data.duration != null) {
    if (typeof data.duration !== "number" || !Number.isFinite(data.duration) || data.duration <= 0) {
      duration = null; // durée calculée côté client : best effort, jamais bloquant
    } else {
      duration = Math.round(data.duration);
    }
  }

  return { name, description, categories, niveau, serieId, newSerieName, episode, duration };
}

/**
 * Vérifie que `stagingPath` désigne bien un objet déposé par CE token et
 * renvoie son extension audio.
 */
function parseStagingPath(stagingPath: unknown, token: string): { path: string; ext: string } {
  if (typeof stagingPath !== "string" || stagingPath.length > 300) {
    throw new HttpsError("invalid-argument", "Chemin de dépôt invalide.");
  }
  const prefix = `studioUploads/${token}/`;
  const fileName = stagingPath.slice(prefix.length);
  if (!stagingPath.startsWith(prefix) || !fileName || fileName.includes("/") || fileName.includes("..")) {
    throw new HttpsError("permission-denied", "Chemin de dépôt invalide.");
  }
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!AUDIO_EXTENSIONS.includes(ext)) {
    throw new HttpsError("invalid-argument", "Format audio non pris en charge.");
  }
  return { path: stagingPath, ext };
}

/**
 * Résout ou crée la série du chiour. Renvoie l'ID de série (ou null hors
 * série). Refuse une série appartenant à un autre auteur.
 */
async function resolveSerie(meta: ChiourMetadata, author: StudioAuthor): Promise<string | null> {
  const db = getFirestore();

  if (meta.newSerieName) {
    const slug = generateSlug(meta.newSerieName);
    if (!slug) throw new HttpsError("invalid-argument", "Nom de série invalide.");
    const serieId = `${author.auteurId}--${slug}`;
    const ref = db.collection("series").doc(serieId);
    const existing = await ref.get();
    if (!existing.exists) {
      await ref.set({
        name: meta.newSerieName,
        slug: serieId,
        auteurId: author.auteurId,
        description: "",
        order: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return serieId;
  }

  if (meta.serieId) {
    const snap = await db.collection("series").doc(meta.serieId).get();
    if (!snap.exists || snap.data()?.auteurId !== author.auteurId) {
      throw new HttpsError("permission-denied", "Série inconnue pour cet auteur.");
    }
    return meta.serieId;
  }

  return null;
}

/**
 * Déplace l'audio du staging vers son chemin public `chiourim/{slug}/audio.{ext}`,
 * pose un token de download permanent et renvoie audioPath/mediaUrl/fileSize.
 * Supprime au passage un éventuel ancien fichier audio du chiour (remplacement
 * avec une autre extension).
 */
async function promoteAudio(
  stagingPath: string,
  ext: string,
  slug: string,
  previousAudioPath?: string | null,
): Promise<{ audioPath: string; mediaUrl: string; fileSize: number | null }> {
  const files = bucket();
  const source = files.file(stagingPath);
  const [exists] = await source.exists();
  if (!exists) {
    throw new HttpsError("not-found", "Fichier audio introuvable. Recommencez l'envoi.");
  }

  const audioPath = `chiourim/${slug}/audio.${ext}`;
  if (previousAudioPath && previousAudioPath !== audioPath) {
    await files
      .file(previousAudioPath)
      .delete()
      .catch(() => undefined); // ancien fichier déjà absent : sans conséquence
  }

  await source.move(audioPath);

  const file = files.file(audioPath);
  const downloadToken = randomUUID();
  await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: downloadToken } });
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);

  // En local, les émulateurs servent les fichiers depuis l'hôte de l'émulateur
  // Storage ; en production, l'URL permanente publique habituelle.
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const base = emulatorHost
    ? `http://${emulatorHost}`
    : "https://firebasestorage.googleapis.com";
  const mediaUrl = `${base}/v0/b/${files.name}/o/${encodeURIComponent(audioPath)}?alt=media&token=${downloadToken}`;

  return { audioPath, mediaUrl, fileSize: Number.isFinite(size) ? size : null };
}

/** Génère un slug de doc chiourim libre (suffixe -2, -3… en cas de collision). */
async function availableChiourSlug(name: string): Promise<string> {
  const db = getFirestore();
  const base = generateSlug(name);
  if (!base) throw new HttpsError("invalid-argument", "Titre invalide.");
  let slug = base;
  for (let i = 2; ; i += 1) {
    const snap = await db.collection("chiourim").doc(slug).get();
    if (!snap.exists) return slug;
    slug = `${base}-${i}`;
  }
}

export const studioSubmitChiour = onCall(async (request) => {
  const data = (request.data ?? {}) as Record<string, unknown>;
  const author = await requireAuthor(data.token);
  const meta = parseMetadata(data);
  const staging = parseStagingPath(data.stagingPath, data.token as string);

  const serieId = await resolveSerie(meta, author);
  const slug = await availableChiourSlug(meta.name);
  const audio = await promoteAudio(staging.path, staging.ext, slug);

  await getFirestore()
    .collection("chiourim")
    .doc(slug)
    .set({
      slug,
      name: meta.name,
      description: meta.description,
      auteur: author.auteurName,
      auteurId: author.auteurId,
      categories: meta.categories,
      niveau: meta.niveau,
      serieId,
      episode: meta.episode,
      audioPath: audio.audioPath,
      mediaUrl: audio.mediaUrl,
      duration: meta.duration,
      fileSize: audio.fileSize,
      published: false, // brouillon : publication réservée à l'admin
      order: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { slug };
});

/** Charge un chiour et vérifie qu'il est bien un brouillon de cet auteur. */
async function requireOwnDraft(slug: unknown, author: StudioAuthor) {
  if (typeof slug !== "string" || !slug || slug.length > 300) {
    throw new HttpsError("invalid-argument", "Chiour invalide.");
  }
  const ref = getFirestore().collection("chiourim").doc(slug);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Chiour introuvable.");
  const doc = snap.data() as Record<string, unknown>;
  if (doc.auteurId !== author.auteurId) {
    throw new HttpsError("permission-denied", "Ce chiour ne vous appartient pas.");
  }
  if (doc.published === true) {
    throw new HttpsError("failed-precondition", "Ce chiour est publié : contactez l'administrateur pour le modifier.");
  }
  return { ref, doc };
}

export const studioUpdateChiour = onCall(async (request) => {
  const data = (request.data ?? {}) as Record<string, unknown>;
  const author = await requireAuthor(data.token);
  const { ref, doc } = await requireOwnDraft(data.slug, author);
  const meta = parseMetadata(data);
  const serieId = await resolveSerie(meta, author);

  const update: Record<string, unknown> = {
    name: meta.name,
    description: meta.description,
    categories: meta.categories,
    niveau: meta.niveau,
    serieId,
    episode: meta.episode,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Remplacement de l'audio : nouveau dépôt en staging à promouvoir.
  if (data.stagingPath != null) {
    const staging = parseStagingPath(data.stagingPath, data.token as string);
    const audio = await promoteAudio(
      staging.path,
      staging.ext,
      ref.id,
      (doc.audioPath as string | null) ?? null,
    );
    update.audioPath = audio.audioPath;
    update.mediaUrl = audio.mediaUrl;
    update.fileSize = audio.fileSize;
    update.duration = meta.duration;
  } else if (meta.duration != null) {
    update.duration = meta.duration;
  }

  await ref.set(update, { merge: true });
  return { slug: ref.id };
});

export const studioDeleteChiour = onCall(async (request) => {
  const data = (request.data ?? {}) as Record<string, unknown>;
  const author = await requireAuthor(data.token);
  const { ref, doc } = await requireOwnDraft(data.slug, author);

  const audioPath = doc.audioPath as string | undefined;
  if (audioPath) {
    await bucket()
      .file(audioPath)
      .delete()
      .catch(() => undefined); // fichier déjà absent : la suppression du doc prime
  }
  await ref.delete();
  return { slug: ref.id };
});
