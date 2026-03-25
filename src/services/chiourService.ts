import { firestoreService } from "./firestoreService";
import type { Chiour, ChiourCategory } from "../models/models";

export class ChiourService {
  async getAllChiourim(): Promise<Chiour[]> {
    return await firestoreService.getChiourim();
  }

  async getChiourimByCategory(category: ChiourCategory): Promise<Chiour[]> {
    return await firestoreService.getChiourimByCategory(category);
  }

  sortByDate(chiourim: Chiour[]): Chiour[] {
    return [...chiourim].sort(
      (a, b) => new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime(),
    );
  }

  filterBySearch(chiourim: Chiour[], searchTerm: string): Chiour[] {
    if (!searchTerm.trim()) return chiourim;
    const lower = searchTerm.toLowerCase();
    return chiourim.filter(
      (c) =>
        c.title.toLowerCase().includes(lower) ||
        c.teacher.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower),
    );
  }

  filterByCategory(chiourim: Chiour[], category: ChiourCategory | "all"): Chiour[] {
    if (category === "all") return chiourim;
    return chiourim.filter((c) => c.category === category);
  }

  async createChiour(chiour: Omit<Chiour, "id" | "createdAt">): Promise<string> {
    return await firestoreService.createChiour(chiour);
  }

  async deleteChiour(chiourId: string): Promise<void> {
    return await firestoreService.deleteChiour(chiourId);
  }
}

export const chiourService = new ChiourService();
