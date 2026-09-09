import { describe, expect, it } from "vitest";
import {
  bookName,
  filterBySearch,
  groupByBook,
  matchesSearch,
  normalizeSearch,
} from "../services/catalogSearch";

/**
 * La recherche du catalogue, partagée par la bibliothèque, la lecture du jour
 * et le partage de lecture : un texte se trouve par son nom hébreu, par son
 * nom latin et par son livre, quelle que soit la graphie tapée.
 */

const TEXTS = [
  { id: 1, name: "ברכות (Berakhot)", livre: "זרעים (Zeraim)", type: "Talmud Bavli" },
  { id: 2, name: "שבת (Shabbat)", livre: "מועד (Moed)", type: "Talmud Bavli" },
  { id: 103, name: "Tehilim 1", livre: "ספר 1 (Sefer 1)", type: "Tehilim" },
  { id: 264, name: "Berechit", livre: "Berechit", type: "Tanakh" },
  { id: 346, name: "מנחה (Min'ha)", livre: "סידור (Sidour)", type: "Sidour" },
];

describe("recherche du catalogue", () => {
  it("trouve un traité par son nom latin comme par son nom hébreu", () => {
    expect(filterBySearch(TEXTS, "Berakhot").map((t) => t.id)).toEqual([1]);
    expect(filterBySearch(TEXTS, "ברכות").map((t) => t.id)).toEqual([1]);
  });

  it("ignore la casse, les accents et la graphie de l'apostrophe", () => {
    expect(matchesSearch(TEXTS[4], "min’ha")).toBe(true);
    expect(matchesSearch(TEXTS[4], "MIN'HA")).toBe(true);
    expect(matchesSearch(TEXTS[3], "béréchit")).toBe(true);
    expect(normalizeSearch("  Sli’hot ")).toBe("sli'hot");
  });

  it("cherche aussi dans le livre ou le seder", () => {
    expect(filterBySearch(TEXTS, "zeraim").map((t) => t.id)).toEqual([1]);
    expect(filterBySearch(TEXTS, "sefer").map((t) => t.id)).toEqual([103]);
  });

  it("rend tout le catalogue quand le terme est vide", () => {
    expect(filterBySearch(TEXTS, "")).toBe(TEXTS);
    expect(filterBySearch(TEXTS, "   ")).toBe(TEXTS);
  });

  it("nomme un livre par sa partie latine", () => {
    expect(bookName("זרעים (Zeraim)")).toBe("Zeraim");
    expect(bookName("Berechit")).toBe("Berechit");
  });

  it("regroupe par livre dans l'ordre du catalogue", () => {
    const groups = groupByBook(TEXTS.filter((t) => t.type === "Talmud Bavli"));
    expect(Object.keys(groups)).toEqual(["זרעים (Zeraim)", "מועד (Moed)"]);
    expect(groups["זרעים (Zeraim)"].map((t) => t.id)).toEqual([1]);
  });
});
