import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import type { Chiour, ChiourDoc } from "../models/models";

/**
 * Lecture des chiourim depuis Firestore (collection `chiourim`).
 *
 * Remplace l'ancien webhook n8n / Notion. Les URLs audio (`mediaUrl`) pointent
 * désormais vers Cloud Storage et sont permanentes : plus besoin de cache court.
 *
 * Le catalogue étant de taille modeste, le filtrage `published` et le tri se font
 * côté client (pas d'index composite à maintenir). Si le volume grossit, basculer
 * vers une requête `where('published','==',true)` + index.
 */
export class ChiourFirestoreRepository {
  async fetchAll(): Promise<Chiour[]> {
    const snap = await getDocs(collection(db, "chiourim"));

    const chiourim = snap.docs
      .map((d) => d.data() as ChiourDoc)
      .filter((doc) => doc.published !== false) // visible sauf brouillon explicite
      .map(
        (doc): Chiour => ({
          slug: doc.slug,
          name: doc.name,
          description: doc.description ?? "",
          auteur: doc.auteur ?? null,
          categories: doc.categories ?? [],
          mediaUrl: doc.mediaUrl ?? "",
          niveau: doc.niveau ?? null,
          auteurId: doc.auteurId ?? null,
          serieId: doc.serieId ?? null,
          episode: doc.episode ?? null,
        }),
      );

    // Tri alphabétique du catalogue ; l'ordre fin se joue dans les séries
    // (numéro d'épisode).
    chiourim.sort((a, b) => a.name.localeCompare(b.name, "fr"));

    return chiourim;
  }
}

export const chiourFirestoreRepository = new ChiourFirestoreRepository();
