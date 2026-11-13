import { describe, expect, it, vi } from "vitest";
import type { Chiour } from "../models/models";
import type { Serie } from "../services/serieService";

/**
 * An episode's title no longer repeats its series (« Chapitre 3 (2/7) »): the
 * chiourim search reads it separately, so that « Pélé Yoets » or « Chaar
 * Habitahon » still find every episode.
 */

vi.mock("../firebase/firestore", () => ({ db: {} }));

const { chiourService } = await import("../services/chiourService");

const chiour = (slug: string, name: string, serieId: string | null): Chiour => ({
  slug,
  name,
  description: "",
  auteur: "Rav Gad GuiGui",
  categories: ["Moussar"],
  mediaUrl: "",
  niveau: null,
  auteurId: null,
  serieId,
  episode: null,
  duration: null,
  addedAt: null,
  texteId: null,
  texteChapitre: null,
});

const series: Serie[] = [
  {
    id: "bita",
    name: "Shaar Habitahon",
    slug: "shaar-habitahon",
    auteurId: "gad",
    description: "",
  },
];
const catalogue = [
  chiour("bita-12", "Chapitre 3 (2/7)", "bita"),
  chiour("isole", "Se taire, la force maîtresse", null),
];
const slugs = (found: Chiour[]) => found.map((c) => c.slug);

describe("chiourim search by series", () => {
  it("finds an episode by its series name, in every spelling", () => {
    expect(slugs(chiourService.filterBySearch(catalogue, "Shaar Habitahon", series))).toEqual([
      "bita-12",
    ]);
    expect(slugs(chiourService.filterBySearch(catalogue, "chaar bitahon", series))).toEqual([
      "bita-12",
    ]);
  });

  it("keeps the search by title", () => {
    expect(slugs(chiourService.filterBySearch(catalogue, "chapitre 3", series))).toEqual([
      "bita-12",
    ]);
  });

  it("searches without the series while they are not loaded", () => {
    expect(slugs(chiourService.filterBySearch(catalogue, "Shaar Habitahon", null))).toEqual([]);
  });
});
