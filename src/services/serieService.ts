import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firestore";
import type { Chiour, SerieDoc } from "../models/models";
import { cached } from "./cached";

export type Serie = SerieDoc & { id: string };

// Même stratégie de cache que chiourService : catalogue modeste, lecture
// publique, on rafraîchit surtout pour voir les nouveautés de l'admin.
const CACHE_TTL = 60 * 60 * 1000; // 1h

/**
 * L'ordre d'une série : par numéro d'épisode, les sans-numéro en fin, par
 * nom. Le même tri sert la page d'une série et le studio des auteurs.
 */
export function byEpisode(
  a: { episode?: number | null; name: string },
  b: { episode?: number | null; name: string },
): number {
  if (a.episode != null && b.episode != null) return a.episode - b.episode;
  if (a.episode != null) return -1;
  if (b.episode != null) return 1;
  return a.name.localeCompare(b.name, "fr");
}

class SerieService {
  private readonly series = cached(CACHE_TTL, async () => {
    const snap = await getDocs(collection(db, "series"));
    const series = snap.docs.map((d) => ({ ...(d.data() as SerieDoc), id: d.id }));
    series.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return series;
  });

  getAllSeries(): Promise<Serie[]> {
    return this.series.get();
  }

  async getSerie(serieId: string): Promise<Serie | null> {
    const series = await this.getAllSeries();
    return series.find((s) => s.id === serieId) ?? null;
  }

  invalidateCache(): void {
    this.series.invalidate();
  }

  /** Épisodes d'une série, triés par numéro (les sans-numéro en fin, par nom). */
  episodesOf(serieId: string, all: Chiour[]): Chiour[] {
    return all.filter((c) => c.serieId === serieId).sort(byEpisode);
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
