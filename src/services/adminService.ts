import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, deleteObject, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase";
import type { AuteurDoc, ChiourDoc, SerieDoc, StudioTokenDoc } from "../models/models";
import { chiourService } from "./chiourService";
import { studioService } from "./studioService";

/**
 * Backoffice admin : CRUD direct Firestore/Storage, autorisé par les règles
 * (`isAdmin()` = compte admin connecté). Aucune Cloud Function nécessaire ici.
 *
 * Toute mutation invalide le cache 1h de chiourService pour que l'app
 * publique (même session) voie les changements immédiatement.
 */

export type AuteurWithId = AuteurDoc & { id: string };
export type SerieWithId = SerieDoc & { id: string };
export type TokenWithId = StudioTokenDoc & { id: string };

/** Champs éditables d'un chiour côté admin. */
export interface ChiourAdminFields {
  name?: string;
  description?: string;
  auteur?: string | null;
  auteurId?: string | null;
  categories?: string[];
  niveau?: string | null;
  serieId?: string | null;
  episode?: number | null;
  published?: boolean;
  duration?: number | null;
}

function slugify(name: string): string {
  return chiourService.generateAuteurSlug(name);
}

/** Token de lien studio : 32 octets aléatoires en hexadécimal (64 caractères). */
export function generateStudioToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class AdminService {
  // --- Chiourim -----------------------------------------------------------

  /** Tous les chiourim, brouillons inclus, sans cache. */
  async listAllChiourim(): Promise<ChiourDoc[]> {
    const snap = await getDocs(collection(db, "chiourim"));
    const docs = snap.docs.map((d) => d.data() as ChiourDoc);
    docs.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return docs;
  }

  async getChiour(slug: string): Promise<ChiourDoc | null> {
    const snap = await getDoc(doc(db, "chiourim", slug));
    return snap.exists() ? (snap.data() as ChiourDoc) : null;
  }

  async updateChiour(slug: string, fields: ChiourAdminFields): Promise<void> {
    await updateDoc(doc(db, "chiourim", slug), { ...fields, updatedAt: serverTimestamp() });
    chiourService.invalidateCache();
  }

  async setPublished(slug: string, published: boolean): Promise<void> {
    await this.updateChiour(slug, { published });
  }

  /** Rattrapage en masse : applique les mêmes champs à plusieurs chiourim. */
  async batchUpdateChiourim(slugs: string[], fields: ChiourAdminFields): Promise<void> {
    const batch = writeBatch(db);
    for (const slug of slugs) {
      batch.update(doc(db, "chiourim", slug), { ...fields, updatedAt: serverTimestamp() });
    }
    await batch.commit();
    chiourService.invalidateCache();
  }

  /** Supprime le doc et son fichier audio. */
  async deleteChiour(chiour: ChiourDoc): Promise<void> {
    if (chiour.audioPath) {
      await deleteObject(storageRef(storage, chiour.audioPath)).catch(() => undefined);
    }
    await deleteDoc(doc(db, "chiourim", chiour.slug));
    chiourService.invalidateCache();
  }

  /**
   * Remplace (ou ajoute) l'audio d'un chiour : upload direct sous
   * `chiourim/{slug}/audio.{ext}` puis mise à jour du doc. `getDownloadURL`
   * crée le token de download permanent.
   */
  async replaceAudio(
    chiour: ChiourDoc,
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<void> {
    const problem = studioService.validateAudioFile(file);
    if (problem) throw new Error(problem);

    const ext = (file.name.split(".").pop() ?? "mp3").toLowerCase();
    const audioPath = `chiourim/${chiour.slug}/audio.${ext}`;
    const contentType = file.type.startsWith("audio/") ? file.type : "audio/mpeg";

    const duration = await studioService.computeDuration(file);
    const task = uploadBytesResumable(storageRef(storage, audioPath), file, { contentType });
    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (s) => onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
        reject,
        () => resolve(),
      );
    });

    // Ancien fichier sous une autre extension : on le retire pour ne pas
    // laisser d'orphelin servi publiquement.
    if (chiour.audioPath && chiour.audioPath !== audioPath) {
      await deleteObject(storageRef(storage, chiour.audioPath)).catch(() => undefined);
    }

    const mediaUrl = await getDownloadURL(storageRef(storage, audioPath));
    await updateDoc(doc(db, "chiourim", chiour.slug), {
      audioPath,
      mediaUrl,
      fileSize: file.size,
      duration,
      updatedAt: serverTimestamp(),
    });
    chiourService.invalidateCache();
  }

  // --- Auteurs ------------------------------------------------------------

  async listAuteurs(): Promise<AuteurWithId[]> {
    const snap = await getDocs(collection(db, "auteurs"));
    const auteurs = snap.docs.map((d) => ({ ...(d.data() as AuteurDoc), id: d.id }));
    auteurs.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return auteurs;
  }

  async getAuteur(auteurId: string): Promise<AuteurWithId | null> {
    const snap = await getDoc(doc(db, "auteurs", auteurId));
    return snap.exists() ? { ...(snap.data() as AuteurDoc), id: snap.id } : null;
  }

  /** Crée l'auteur et son premier lien studio. Renvoie l'ID et le token. */
  async createAuteur(name: string): Promise<{ auteurId: string; token: string }> {
    const trimmed = name.trim();
    const slug = slugify(trimmed);
    if (!trimmed || !slug) throw new Error("invalid name");
    const ref = doc(db, "auteurs", slug);
    if ((await getDoc(ref)).exists()) throw new Error("already-exists");

    await setDoc(ref, {
      name: trimmed,
      slug,
      bio: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const token = await this.createToken(slug, trimmed);
    return { auteurId: slug, token };
  }

  /**
   * Renomme un auteur et propage le nouveau nom (dénormalisé) sur ses
   * chiourim et ses tokens, en un seul batch.
   */
  async renameAuteur(auteurId: string, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("invalid name");
    const batch = writeBatch(db);
    batch.update(doc(db, "auteurs", auteurId), { name: trimmed, updatedAt: serverTimestamp() });

    const [chiourim, tokens] = await Promise.all([
      getDocs(query(collection(db, "chiourim"), where("auteurId", "==", auteurId))),
      getDocs(query(collection(db, "studioTokens"), where("auteurId", "==", auteurId))),
    ]);
    chiourim.docs.forEach((d) => batch.update(d.ref, { auteur: trimmed, updatedAt: serverTimestamp() }));
    tokens.docs.forEach((d) => batch.update(d.ref, { auteurName: trimmed }));

    await batch.commit();
    chiourService.invalidateCache();
  }

  /** Supprime un auteur sans chiourim (sinon refuse), tokens compris. */
  async deleteAuteur(auteurId: string): Promise<void> {
    const chiourim = await getDocs(
      query(collection(db, "chiourim"), where("auteurId", "==", auteurId)),
    );
    if (!chiourim.empty) throw new Error("has-chiourim");

    const tokens = await getDocs(
      query(collection(db, "studioTokens"), where("auteurId", "==", auteurId)),
    );
    const batch = writeBatch(db);
    tokens.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "auteurs", auteurId));
    await batch.commit();
  }

  // --- Tokens (liens studio) ----------------------------------------------

  async listTokens(auteurId: string): Promise<TokenWithId[]> {
    const snap = await getDocs(
      query(collection(db, "studioTokens"), where("auteurId", "==", auteurId)),
    );
    return snap.docs.map((d) => ({ ...(d.data() as StudioTokenDoc), id: d.id }));
  }

  async createToken(auteurId: string, auteurName: string): Promise<string> {
    const token = generateStudioToken();
    await setDoc(doc(db, "studioTokens", token), {
      auteurId,
      auteurName,
      active: true,
      createdAt: serverTimestamp(),
    });
    return token;
  }

  async revokeToken(token: string): Promise<void> {
    await updateDoc(doc(db, "studioTokens", token), { active: false });
  }

  /** Régénère le lien : supprime les anciens tokens et en crée un neuf. */
  async regenerateToken(auteurId: string, auteurName: string): Promise<string> {
    const existing = await this.listTokens(auteurId);
    const batch = writeBatch(db);
    existing.forEach((t) => batch.delete(doc(db, "studioTokens", t.id)));
    await batch.commit();
    return this.createToken(auteurId, auteurName);
  }

  studioLinkFor(token: string): string {
    return `${window.location.origin}/studio/${token}`;
  }

  // --- Séries -------------------------------------------------------------

  async listSeries(auteurId?: string): Promise<SerieWithId[]> {
    const base = collection(db, "series");
    const snap = await getDocs(auteurId ? query(base, where("auteurId", "==", auteurId)) : base);
    const series = snap.docs.map((d) => ({ ...(d.data() as SerieDoc), id: d.id }));
    series.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return series;
  }

  async createSerie(auteurId: string, name: string): Promise<string> {
    const trimmed = name.trim();
    const slug = slugify(trimmed);
    if (!trimmed || !slug) throw new Error("invalid name");
    const serieId = `${auteurId}--${slug}`;
    const ref = doc(db, "series", serieId);
    if ((await getDoc(ref)).exists()) throw new Error("already-exists");
    await setDoc(ref, {
      name: trimmed,
      slug: serieId,
      auteurId,
      description: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return serieId;
  }

  async updateSerie(serieId: string, fields: Partial<Pick<SerieDoc, "name" | "description">>): Promise<void> {
    await updateDoc(doc(db, "series", serieId), { ...fields, updatedAt: serverTimestamp() });
  }

  /** Supprime la série et détache ses chiourim (serieId/episode remis à null). */
  async deleteSerie(serieId: string): Promise<void> {
    const chiourim = await getDocs(
      query(collection(db, "chiourim"), where("serieId", "==", serieId)),
    );
    const batch = writeBatch(db);
    chiourim.docs.forEach((d) =>
      batch.update(d.ref, { serieId: null, episode: null, updatedAt: serverTimestamp() }),
    );
    batch.delete(doc(db, "series", serieId));
    await batch.commit();
    chiourService.invalidateCache();
  }
}

export const adminService = new AdminService();
