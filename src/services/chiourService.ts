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
    .replace(/[/'"""''`]/g, "");
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
  };
}

export class ChiourService {
  async getAllChiourim(): Promise<Chiour[]> {
    const data = await chiourRepository.fetchAll();
    return data.map(mapWebhookToChiour);
  }

  async getChiourBySlug(slug: string): Promise<Chiour | null> {
    const all = await this.getAllChiourim();
    return all.find((c) => c.slug === slug) ?? null;
  }

  async getCategories(): Promise<string[]> {
    return await chiourRepository.fetchCategories();
  }

  getRecommendations(current: Chiour, allChiourim: Chiour[], max = 3): Chiour[] {
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

  getAuteurs(chiourim: Chiour[]): string[] {
    const set = new Set<string>();
    for (const c of chiourim) {
      if (c.auteur) set.add(c.auteur);
    }
    return Array.from(set).sort();
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
