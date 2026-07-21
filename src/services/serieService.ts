import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import type { Chiour, SerieDoc } from "../models/models";

export type Serie = SerieDoc & { id: string };

// Même stratégie de cache que chiourService : catalogue modeste, lecture
// publique, on rafraîchit surtout pour voir les nouveautés de l'admin.
const CACHE_TTL = 60 * 60 * 1000; // 1h

export class SerieService {
  private cache: { data: Serie[]; fetchedAt: number } | null = null;
  private fetchPromise: Promise<Serie[]> | null = null;

  async getAllSeries(): Promise<Serie[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL) {
      return this.cache.data;
    }
    if (!this.fetchPromise) {
      this.fetchPromise = getDocs(collection(db, "series"))
        .then((snap) => {
          const series = snap.docs.map((d) => ({ ...(d.data() as SerieDoc), id: d.id }));
          series.sort((a, b) => a.name.localeCompare(b.name, "fr"));
          this.cache = { data: series, fetchedAt: Date.now() };
          return series;
        })
        .finally(() => {
          this.fetchPromise = null;
        });
    }
    return this.fetchPromise;
  }

  async getSerie(serieId: string): Promise<Serie | null> {
    const series = await this.getAllSeries();
    return series.find((s) => s.id === serieId) ?? null;
  }

  async getSeriesForAuteur(auteurId: string): Promise<Serie[]> {
    const series = await this.getAllSeries();
    return series.filter((s) => s.auteurId === auteurId);
  }

  invalidateCache(): void {
    this.cache = null;
  }

  /** Épisodes d'une série, triés par numéro (les sans-numéro en fin, par nom). */
  episodesOf(serieId: string, all: Chiour[]): Chiour[] {
    const episodes = all.filter((c) => c.serieId === serieId);
    episodes.sort((a, b) => {
      if (a.episode != null && b.episode != null) return a.episode - b.episode;
      if (a.episode != null) return -1;
      if (b.episode != null) return 1;
      return a.name.localeCompare(b.name, "fr");
    });
    return episodes;
  }

  /** Épisode suivant du même chiour dans sa série, ou null. */
  getNextEpisode(current: Chiour, all: Chiour[]): Chiour | null {
    if (!current.serieId || current.episode == null) return null;
    const candidates = all.filter(
      (c) =>
        c.serieId === current.serieId &&
        c.slug !== current.slug &&
        c.episode != null &&
        c.episode > (current.episode as number),
    );
    candidates.sort((a, b) => (a.episode as number) - (b.episode as number));
    return candidates[0] ?? null;
  }

  /** Épisode précédent du même chiour dans sa série, ou null. */
  getPreviousEpisode(current: Chiour, all: Chiour[]): Chiour | null {
    if (!current.serieId || current.episode == null) return null;
    const candidates = all.filter(
      (c) =>
        c.serieId === current.serieId &&
        c.slug !== current.slug &&
        c.episode != null &&
        c.episode < (current.episode as number),
    );
    candidates.sort((a, b) => (b.episode as number) - (a.episode as number));
    return candidates[0] ?? null;
  }
}

export const serieService = new SerieService();
