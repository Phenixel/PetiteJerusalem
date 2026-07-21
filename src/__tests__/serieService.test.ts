import { describe, it, expect, vi } from "vitest";
import type { Chiour } from "../models/models";

// serieService importe l'app Firebase : on la neutralise, les fonctions
// testées ici (tri des épisodes, épisode suivant) sont pures.
vi.mock("../../firebase", () => ({ db: {}, auth: {}, storage: {}, functions: {} }));

import { serieService } from "../services/serieService";

function chiour(partial: Partial<Chiour> & { slug: string }): Chiour {
  return {
    name: partial.slug,
    description: "",
    auteur: null,
    categories: [],
    mediaUrl: "",
    niveau: null,
    auteurId: null,
    serieId: null,
    episode: null,
    ...partial,
  };
}

const SERIE = "rav-cohen--halakha";

const catalogue: Chiour[] = [
  chiour({ slug: "ep3", name: "Troisième", serieId: SERIE, episode: 3 }),
  chiour({ slug: "ep1", name: "Premier", serieId: SERIE, episode: 1 }),
  chiour({ slug: "sans-numero", name: "Annexe", serieId: SERIE, episode: null }),
  chiour({ slug: "ep2", name: "Deuxième", serieId: SERIE, episode: 2 }),
  chiour({ slug: "autre-serie", name: "Autre", serieId: "autre--serie", episode: 1 }),
  chiour({ slug: "hors-serie", name: "Hors série" }),
];

describe("serieService.episodesOf", () => {
  it("trie par numéro d'épisode, les sans-numéro en fin", () => {
    const episodes = serieService.episodesOf(SERIE, catalogue);
    expect(episodes.map((c) => c.slug)).toEqual(["ep1", "ep2", "ep3", "sans-numero"]);
  });

  it("ignore les chiourim des autres séries et hors série", () => {
    const episodes = serieService.episodesOf(SERIE, catalogue);
    expect(episodes.some((c) => c.slug === "autre-serie")).toBe(false);
    expect(episodes.some((c) => c.slug === "hors-serie")).toBe(false);
  });
});

describe("serieService.getNextEpisode", () => {
  it("renvoie l'épisode au numéro immédiatement supérieur", () => {
    const current = catalogue.find((c) => c.slug === "ep1")!;
    expect(serieService.getNextEpisode(current, catalogue)?.slug).toBe("ep2");
  });

  it("saute les trous de numérotation", () => {
    const sansEp2 = catalogue.filter((c) => c.slug !== "ep2");
    const current = catalogue.find((c) => c.slug === "ep1")!;
    expect(serieService.getNextEpisode(current, sansEp2)?.slug).toBe("ep3");
  });

  it("renvoie null pour le dernier épisode", () => {
    const current = catalogue.find((c) => c.slug === "ep3")!;
    expect(serieService.getNextEpisode(current, catalogue)).toBeNull();
  });

  it("renvoie null hors série ou sans numéro d'épisode", () => {
    const horsSerie = catalogue.find((c) => c.slug === "hors-serie")!;
    const sansNumero = catalogue.find((c) => c.slug === "sans-numero")!;
    expect(serieService.getNextEpisode(horsSerie, catalogue)).toBeNull();
    expect(serieService.getNextEpisode(sansNumero, catalogue)).toBeNull();
  });
});

describe("serieService.getPreviousEpisode", () => {
  it("renvoie l'épisode au numéro immédiatement inférieur", () => {
    const current = catalogue.find((c) => c.slug === "ep3")!;
    expect(serieService.getPreviousEpisode(current, catalogue)?.slug).toBe("ep2");
  });

  it("saute les trous de numérotation", () => {
    const sansEp2 = catalogue.filter((c) => c.slug !== "ep2");
    const current = catalogue.find((c) => c.slug === "ep3")!;
    expect(serieService.getPreviousEpisode(current, sansEp2)?.slug).toBe("ep1");
  });

  it("renvoie null pour le premier épisode et hors série", () => {
    const premier = catalogue.find((c) => c.slug === "ep1")!;
    const horsSerie = catalogue.find((c) => c.slug === "hors-serie")!;
    expect(serieService.getPreviousEpisode(premier, catalogue)).toBeNull();
    expect(serieService.getPreviousEpisode(horsSerie, catalogue)).toBeNull();
  });
});
