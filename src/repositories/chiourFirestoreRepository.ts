import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firestore";
import type { Chiour, ChiourDoc } from "../models/models";

/** Un Timestamp Firestore (ou une date) en millisecondes, null sinon. */
function millisOf(value: unknown): number | null {
  const maybe = value as { toMillis?: () => number } | null | undefined;
  if (typeof maybe?.toMillis === "function") return maybe.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

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
    duration:
      typeof docData.duration === "number" && docData.duration > 0 ? docData.duration : null,
    addedAt: millisOf(docData.createdAt),
    texteId: typeof docData.texteId === "number" ? docData.texteId : null,
    texteChapitre:
      typeof docData.texteId === "number" && typeof docData.texteChapitre === "number"
        ? docData.texteChapitre
        : null,
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
class ChiourFirestoreRepository {
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
   * afficher son contenu, le catalogue ne sert qu'aux recommandations.
   */
  /**
   * Les cours publiés d'un texte de la bibliothèque (voir ChiourDoc.texteId) :
   * la page d'un livre n'a pas à charger tout le catalogue pour montrer ses
   * cours. Un index d'un seul champ, que Firestore pose de lui-même.
   */
  async fetchByTexte(texteId: number): Promise<Chiour[]> {
    const snap = await getDocs(query(collection(db, "chiourim"), where("texteId", "==", texteId)));
    return snap.docs
      .map((d) => d.data() as ChiourDoc)
      .filter((doc) => doc.published !== false)
      .map(toChiour);
  }

  async fetchBySlug(slug: string): Promise<Chiour | null> {
    const snap = await getDoc(doc(db, "chiourim", slug));
    if (!snap.exists()) return null;
    const data = snap.data() as ChiourDoc;
    if (data.published === false) return null;
    return toChiour(data);
  }
}

export const chiourFirestoreRepository = new ChiourFirestoreRepository();
