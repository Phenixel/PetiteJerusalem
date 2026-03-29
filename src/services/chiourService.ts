import type { Chiour } from "../models/models";
import { chiourRepository } from "../repositories/chiourRepository";
import type { WebhookChiour } from "../repositories/chiourRepository";

function parseMediaUrl(medias: string): string {
  try {
    const parsed = JSON.parse(medias);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
  } catch {
    // ignore parse errors
  }
  return "";
}

function generateChiourSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/'"""''`?#]/g, "");
}

function mapWebhookToChiour(item: WebhookChiour): Chiour {
  return {
    slug: generateChiourSlug(item.name),
    name: item.name,
    description: item.property_description || "",
    auteur: item.property_auteur,
    categories: item.property_cat_gorie || [],
    mediaUrl: parseMediaUrl(item.property_medias),
    niveau: item.property_niveau,
    link: item.property_link || null,
  };
}

const MEDIA_TTL = 60 * 60 * 1000; // 1h — Notion media URLs expire after ~1h

interface Cache<T> {
  data: T;
  fetchedAt: number;
}

export class ChiourService {
  private chiourimCache: Cache<Chiour[]> | null = null;
  private categoriesCache: Cache<string[]> | null = null;
  private fetchPromise: Promise<Chiour[]> | null = null;
  private categoriesFetchPromise: Promise<string[]> | null = null;

  async getAllChiourim(): Promise<Chiour[]> {
    if (this.chiourimCache && Date.now() - this.chiourimCache.fetchedAt < MEDIA_TTL) {
      return this.chiourimCache.data;
    }

    // Deduplicate concurrent requests
    if (!this.fetchPromise) {
      this.fetchPromise = chiourRepository
        .fetchAll()
        .then((data) => {
          const chiourim = data.map(mapWebhookToChiour);
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
    return Date.now() - this.chiourimCache.fetchedAt >= MEDIA_TTL;
  }

  async getCategories(): Promise<string[]> {
    if (this.categoriesCache && Date.now() - this.categoriesCache.fetchedAt < MEDIA_TTL) {
      return this.categoriesCache.data;
    }

    if (!this.categoriesFetchPromise) {
      this.categoriesFetchPromise = chiourRepository
        .fetchCategories()
        .then((data) => {
          this.categoriesCache = { data, fetchedAt: Date.now() };
          return data;
        })
        .finally(() => {
          this.categoriesFetchPromise = null;
        });
    }
    return this.categoriesFetchPromise;
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
