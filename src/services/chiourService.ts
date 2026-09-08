import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase/firestore";
import type { Chiour } from "../models/models";
import { chiourFirestoreRepository } from "../repositories/chiourFirestoreRepository";
import { cached } from "./cached";

function generateChiourSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/'"""''`?#]/g, "");
}

// Cache court : les chiourim viennent de Firestore (URLs audio permanentes).
// On rafraîchit surtout pour voir les nouveaux chiourim ajoutés via l'admin.
const CACHE_TTL = 60 * 60 * 1000; // 1h

class ChiourService {
  private readonly chiourim = cached(CACHE_TTL, () => chiourFirestoreRepository.fetchAll());

  // Catégories dérivées des chiourim (plus de source séparée).
  private readonly categories = cached(CACHE_TTL, async () => {
    const chiourim = await this.getAllChiourim();
    const set = new Set<string>();
    chiourim.forEach((c) => c.categories.forEach((cat) => set.add(cat)));
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  });

  getAllChiourim(): Promise<Chiour[]> {
    return this.chiourim.get();
  }

  getCachedChiourim(): Chiour[] | null {
    return this.chiourim.peek();
  }

  /**
   * Un chiour précis, au coût d'un seul document : sert le premier rendu
   * d'un lien partagé à froid. Le cache catalogue est utilisé s'il est frais ;
   * sinon on lit le document seul, sans déclencher le chargement du catalogue
   * (les recommandations le chargeront en arrière-plan).
   */
  async getChiourBySlug(slug: string): Promise<Chiour | null> {
    const fresh = this.chiourim.isStale() ? null : this.chiourim.peek();
    if (fresh) return fresh.find((c) => c.slug === slug) ?? null;
    return chiourFirestoreRepository.fetchBySlug(slug);
  }

  /** À appeler après toute mutation admin pour refléter le changement sans attendre le TTL. */
  invalidateCache(): void {
    this.chiourim.invalidate();
    this.categories.invalidate();
  }

  /**
   * Comptabilise une vue (ouverture de la page du chiour), une seule fois par
   * session de navigation. Best effort : jamais bloquant pour le visiteur,
   * les rules ne laissent passer que l'incrément +1 sur un chiour publié.
   */
  registerView(slug: string): void {
    const key = `chiour-viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage indisponible (navigation privée stricte…) : on compte
      // quand même la vue, au pire un rechargement en comptera une de plus.
    }
    updateDoc(doc(db, "chiourim", slug), { views: increment(1) }).catch((error) => {
      // Hors ligne, brouillon, ou doc supprimé : la vue est simplement perdue.
      console.warn("Vue non comptabilisée:", error?.code ?? error);
    });
  }

  isCacheStale(): boolean {
    return this.chiourim.isStale();
  }

  getCategories(): Promise<string[]> {
    return this.categories.get();
  }

  getRecommendations(current: Chiour, allChiourim: Chiour[], max = 2): Chiour[] {
    const others = allChiourim.filter((c) => c.slug !== current.slug);

    const scored = others.map((c) => {
      let score = 0;
      for (const cat of c.categories) {
        if (current.categories.includes(cat)) score += 2;
      }
      if (c.auteur && c.auteur === current.auteur) score += 1;
      return { chiour: c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, max).map((s) => s.chiour);
  }

  filterBySearch(chiourim: Chiour[], searchTerm: string): Chiour[] {
    if (!searchTerm.trim()) return chiourim;
    const lower = searchTerm.toLowerCase();
    return chiourim.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.auteur?.toLowerCase().includes(lower) ?? false) ||
        c.description.toLowerCase().includes(lower),
    );
  }

  filterByCategory(chiourim: Chiour[], category: string): Chiour[] {
    if (category === "all") return chiourim;
    return chiourim.filter((c) => c.categories.includes(category));
  }

  filterByAuteur(chiourim: Chiour[], auteur: string): Chiour[] {
    return chiourim.filter((c) => c.auteur === auteur);
  }

  generateAuteurSlug(auteur: string): string {
    return generateChiourSlug(auteur);
  }

  findAuteurBySlug(chiourim: Chiour[], slug: string): string | null {
    for (const c of chiourim) {
      if (c.auteur && generateChiourSlug(c.auteur) === slug) return c.auteur;
    }
    return null;
  }
}

export const chiourService = new ChiourService();
