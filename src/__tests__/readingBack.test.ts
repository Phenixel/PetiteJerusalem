import { describe, it, expect } from "vitest";
import { resolveBackNavigation, stripQuery } from "../composables/readingBack";

const HUB = "/bibliotheque/talmud/berakhot";
const CORPUS = "/bibliotheque/talmud";
const isCurrentTextPath = (p: string) => p === HUB || p.startsWith(`${HUB}/`);

/** « Retour » depuis un chapitre : remonte à la liste des chapitres. */
const fromSection = (previousPath: string | null) =>
  resolveBackNavigation({ previousPath, parentPath: HUB, isCurrentTextPath, preferHistory: false });

/** « Retour » depuis la liste des chapitres : quitte le texte. */
const fromHub = (previousPath: string | null) =>
  resolveBackNavigation({
    previousPath,
    parentPath: CORPUS,
    isCurrentTextPath,
    preferHistory: true,
  });

describe("resolveBackNavigation", () => {
  it("revient en arrière quand la liste des chapitres est l'entrée précédente", () => {
    expect(fromSection(HUB)).toBe("back");
  });

  it("remonte à la liste des chapitres depuis un chapitre ouvert par un lien", () => {
    expect(fromSection("/bibliotheque/lecture-du-jour")).toBe("parent");
    expect(fromSection(null)).toBe("parent");
  });

  it("remonte à la liste plutôt qu'au chapitre précédemment lu", () => {
    expect(fromSection(`${HUB}/12`)).toBe("parent");
  });

  it("rend la main à l'écran d'où vient le lecteur en quittant le texte", () => {
    expect(fromHub("/")).toBe("back");
    expect(fromHub(CORPUS)).toBe("back");
  });

  it("ne retourne jamais dans un chapitre du texte qu'on quitte", () => {
    expect(fromHub(`${HUB}/2`)).toBe("parent");
  });

  it("remonte à la bibliothèque quand il n'y a rien derrière (lien direct)", () => {
    expect(fromHub(null)).toBe("parent");
  });

  // Le bug : chapitre → « Retour » empilait la liste des chapitres, dont
  // « Retour » revenait sur le chapitre — et ainsi de suite sans fin.
  it("sort du texte en deux « Retour », sans aller-retour sans fin", () => {
    // Bibliothèque → liste des chapitres → chapitre.
    expect(fromSection(HUB)).toBe("back"); // 1er retour : la liste, sans empiler.
    expect(fromHub(CORPUS)).toBe("back"); // 2e retour : la bibliothèque. Terminé.
  });
});

describe("stripQuery", () => {
  it("ne garde que le chemin", () => {
    expect(stripQuery("/bibliotheque/tehilim/121?verset=3")).toBe("/bibliotheque/tehilim/121");
    expect(stripQuery("/lire/5#haut")).toBe("/lire/5");
    expect(stripQuery("/bibliotheque")).toBe("/bibliotheque");
  });
});
