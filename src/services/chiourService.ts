import type { Chiour } from "../models/models";
import { chiourFirestoreRepository } from "../repositories/chiourFirestoreRepository";

function generateChiourSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/'"""''`?#]/g, "");
}

// Cache court : les chiourim viennent de Firestore (URLs audio permanentes).
// On rafraîchit surtout pour voir les nouveaux chiourim ajoutés via l'admin.
const CACHE_TTL = 60 * 60 * 1000; // 1h

interface Cache<T> {
  data: T;
  fetchedAt: number;
}

export class ChiourService {
  private chiourimCache: Cache<Chiour[]> | null = null;
  private categoriesCache: Cache<string[]> | null = null;
  private fetchPromise: Promise<Chiour[]> | null = null;

  async getAllChiourim(): Promise<Chiour[]> {
    if (this.chiourimCache && Date.now() - this.chiourimCache.fetchedAt < CACHE_TTL) {
      return this.chiourimCache.data;
    }

    // Deduplicate concurrent requests
    if (!this.fetchPromise) {
      this.fetchPromise = chiourFirestoreRepository
        .fetchAll()
        .then((chiourim) => {
          this.chiourimCache = { data: chiourim, fetchedAt: Date.now() };
          return chiourim;
        })
        .finally(() => {
          this.fetchPromise = null;
        });
    }
    return this.fetchPromise;
  }

  getCachedChiourim(): Chiour[] | null {
    return this.chiourimCache?.data ?? null;
  }

  isCacheStale(): boolean {
    if (!this.chiourimCache) return true;
    return Date.now() - this.chiourimCache.fetchedAt >= CACHE_TTL;
  }

  async getCategories(): Promise<string[]> {
    if (this.categoriesCache && Date.now() - this.categoriesCache.fetchedAt < CACHE_TTL) {
      return this.categoriesCache.data;
    }
    // Catégories dérivées des chiourim (plus de source séparée).
    const chiourim = await this.getAllChiourim();
    const set = new Set<string>();
    chiourim.forEach((c) => c.categories.forEach((cat) => set.add(cat)));
    const cats = [...set].sort((a, b) => a.localeCompare(b, "fr"));
    this.categoriesCache = { data: cats, fetchedAt: Date.now() };
    return cats;
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
