import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "../../firebase";
import type { ChiourDoc, SerieDoc, StudioTokenDoc } from "../models/models";

/**
 * Studio auteurs (/studio/:token) : accès par lien secret, sans compte.
 *
 * L'audio part en direct vers la zone de staging Storage
 * `studioUploads/{token}/{uuid}.{ext}` (autorisée par une règle cross-service
 * qui valide le token), puis la callable `studioSubmitChiour` déplace le
 * fichier vers son chemin public et crée le doc en brouillon. Le token ne
 * transite jamais dans une URL publique.
 */

const MAX_AUDIO_BYTES = 200 * 1024 * 1024; // aligné sur storage.rules

// Extensions acceptées et contentType de secours quand le navigateur ne
// renseigne pas file.type (les règles Storage exigent audio/*).
const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

export interface StudioChiourPayload {
  name: string;
  description: string;
  categories: string[];
  niveau: string | null;
  serieId: string | null;
  newSerieName: string | null;
  episode: number | null;
  duration: number | null;
}

export interface StudioAuthor {
  auteurId: string;
  auteurName: string;
}

function audioExt(file: File): string | null {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  return ext in AUDIO_MIME_BY_EXT ? ext : null;
}

export class StudioService {
  /** Résout un token de lien studio. Renvoie null si inconnu ou révoqué. */
  async resolveToken(token: string): Promise<StudioAuthor | null> {
    if (!token || token.length > 128) return null;
    try {
      const snap = await getDoc(doc(db, "studioTokens", token));
      const data = snap.data() as StudioTokenDoc | undefined;
      if (!snap.exists() || data?.active !== true) return null;
      return { auteurId: data.auteurId, auteurName: data.auteurName };
    } catch {
      return null;
    }
  }

  /** Tous les chiourim de l'auteur, brouillons inclus (lecture publique). */
  async listMyChiourim(auteurId: string): Promise<ChiourDoc[]> {
    const snap = await getDocs(
      query(collection(db, "chiourim"), where("auteurId", "==", auteurId)),
    );
    const docs = snap.docs.map((d) => d.data() as ChiourDoc);
    // Brouillons d'abord (ce sont eux que l'auteur retouche), puis par nom.
    docs.sort((a, b) => {
      if (a.published !== b.published) return a.published ? 1 : -1;
      return a.name.localeCompare(b.name, "fr");
    });
    return docs;
  }

  /** Les séries de l'auteur (pour le choix dans le formulaire). */
  async listMySeries(auteurId: string): Promise<(SerieDoc & { id: string })[]> {
    const snap = await getDocs(query(collection(db, "series"), where("auteurId", "==", auteurId)));
    const series = snap.docs.map((d) => ({ ...(d.data() as SerieDoc), id: d.id }));
    series.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return series;
  }

  /** Message de validation locale du fichier, ou null s'il est acceptable. */
  validateAudioFile(file: File): "notAudio" | "tooBig" | null {
    if (!audioExt(file)) return "notAudio";
    if (file.size >= MAX_AUDIO_BYTES) return "tooBig";
    return null;
  }

  /**
   * Upload résumable vers la zone de staging. Renvoie le chemin déposé, à
   * passer ensuite à submitChiour/updateChiour.
   */
  uploadAudio(
    token: string,
    file: File,
    onProgress: (percent: number) => void,
  ): { promise: Promise<string>; cancel: () => void } {
    const ext = audioExt(file);
    if (!ext) throw new Error("unsupported audio file");
    const stagingPath = `studioUploads/${token}/${crypto.randomUUID()}.${ext}`;
    const contentType = file.type.startsWith("audio/") ? file.type : AUDIO_MIME_BY_EXT[ext];
    const task = uploadBytesResumable(storageRef(storage, stagingPath), file, { contentType });

    const promise = new Promise<string>((resolve, reject) => {
      task.on(
        "state_changed",
        (s) => onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
        reject,
        () => resolve(stagingPath),
      );
    });
    return { promise, cancel: () => task.cancel() };
  }

  /**
   * Durée du fichier en secondes via l'API Audio du navigateur. Best effort :
   * null si le navigateur ne sait pas décoder les métadonnées.
   */
  computeDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      const done = (value: number | null) => {
        URL.revokeObjectURL(url);
        resolve(value);
      };
      audio.addEventListener("loadedmetadata", () => {
        done(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : null);
      });
      audio.addEventListener("error", () => done(null));
      audio.src = url;
    });
  }

  async submitChiour(
    token: string,
    stagingPath: string,
    payload: StudioChiourPayload,
  ): Promise<string> {
    const call = httpsCallable<Record<string, unknown>, { slug: string }>(
      functions,
      "studioSubmitChiour",
    );
    const res = await call({ token, stagingPath, ...payload });
    return res.data.slug;
  }

  async updateChiour(
    token: string,
    slug: string,
    payload: StudioChiourPayload,
    stagingPath: string | null,
  ): Promise<string> {
    const call = httpsCallable<Record<string, unknown>, { slug: string }>(
      functions,
      "studioUpdateChiour",
    );
    const res = await call({ token, slug, ...payload, stagingPath: stagingPath ?? undefined });
    return res.data.slug;
  }

  async deleteChiour(token: string, slug: string): Promise<void> {
    const call = httpsCallable<Record<string, unknown>, { slug: string }>(
      functions,
      "studioDeleteChiour",
    );
    await call({ token, slug });
  }
}

export const studioService = new StudioService();
