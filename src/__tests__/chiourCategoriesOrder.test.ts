import { describe, expect, it, vi } from "vitest";
import type { Chiour } from "../models/models";

/**
 * Les catégories de la page d'un auteur se rangeaient par code Unicode
 * (`sort()` nu) : « Émouna » passait après « Tora ». Le catalogue, lui, les
 * range dans l'ordre du français ; les deux passent désormais par la même
 * fonction.
 */

vi.mock("../firebase/firestore", () => ({ db: {} }));

const { sortedCategories } = await import("../services/chiourService");

const chiour = (categories: string[]): Chiour => ({
  slug: categories.join("-"),
  name: "",
  description: "",
  auteur: null,
  categories,
  mediaUrl: "",
  niveau: null,
  auteurId: null,
  serieId: null,
  episode: null,
});

describe("ordre des catégories", () => {
  it("suit le français, accents compris, sans doublon", () => {
    expect(sortedCategories([chiour(["Tora", "Émouna"]), chiour(["Halakha", "Tora"])])).toEqual([
      "Émouna",
      "Halakha",
      "Tora",
    ]);
  });
});
