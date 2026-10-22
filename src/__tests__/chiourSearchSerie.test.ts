import { describe, expect, it, vi } from "vitest";
import type { Chiour } from "../models/models";
import type { Serie } from "../services/serieService";

/**
 * Le titre d'un épisode ne répète plus sa série (« Chapitre 3 (2/7) ») : la
 * recherche des chiourim la lit à part, pour que « Pélé Yoets » ou « Chaar
 * Habitahon » trouvent encore tous les épisodes.
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
  { id: "bita", name: "Shaar Habitahon", slug: "shaar-habitahon", auteurId: "gad", description: "" },
];
const catalogue = [
  chiour("bita-12", "Chapitre 3 (2/7)", "bita"),
  chiour("isole", "Se taire, la force maîtresse", null),
];
const slugs = (found: Chiour[]) => found.map((c) => c.slug);

describe("recherche des chiourim par série", () => {
  it("trouve un épisode par le nom de sa série, dans toutes ses graphies", () => {
    expect(slugs(chiourService.filterBySearch(catalogue, "Shaar Habitahon", series))).toEqual([
      "bita-12",
    ]);
    expect(slugs(chiourService.filterBySearch(catalogue, "chaar bitahon", series))).toEqual([
      "bita-12",
    ]);
  });

  it("garde la recherche par titre", () => {
    expect(slugs(chiourService.filterBySearch(catalogue, "chapitre 3", series))).toEqual([
      "bita-12",
    ]);
  });

  it("cherche sans les séries tant qu'elles ne sont pas lues", () => {
    expect(slugs(chiourService.filterBySearch(catalogue, "Shaar Habitahon", null))).toEqual([]);
  });
});
