import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import type { Chiour, ChiourDoc } from "../models/models";

function toChiour(docData: ChiourDoc): Chiour {
  return {
    slug: docData.slug,
    name: docData.name,
    description: docData.description ?? "",
    auteur: docData.auteur ?? null,
    categories: docData.categories ?? [],
    mediaUrl: docData.mediaUrl ?? "",
    niveau: docData.niveau ?? null,
    auteurId: docData.auteurId ?? null,
    serieId: docData.serieId ?? null,
    episode: docData.episode ?? null,
  };
}

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
      .map(toChiour);

    // Tri alphabétique du catalogue ; l'ordre fin se joue dans les séries
    // (numéro d'épisode).
    chiourim.sort((a, b) => a.name.localeCompare(b.name, "fr"));

    return chiourim;
  }

  /**
   * Un seul chiour par slug (l'id du document EST le slug) : la page détail
   * d'un lien partagé n'a pas besoin de télécharger tout le catalogue pour
   * afficher son contenu — le catalogue ne sert qu'aux recommandations.
   */
  async fetchBySlug(slug: string): Promise<Chiour | null> {
    const snap = await getDoc(doc(db, "chiourim", slug));
    if (!snap.exists()) return null;
    const data = snap.data() as ChiourDoc;
    if (data.published === false) return null;
    return toChiour(data);
  }
}

export const chiourFirestoreRepository = new ChiourFirestoreRepository();
