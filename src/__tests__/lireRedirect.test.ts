import { describe, expect, it } from "vitest";
import { lireRedirect } from "../router/lireRedirect";

/**
 * Un lien public /lire/:textId (sans chaîne de lecture) est renvoyé vers la
 * page canonique de la bibliothèque, par le routeur : la redirection au
 * montage de la vue laissait une page blanche, la vue étant réutilisée d'une
 * adresse à l'autre.
 */
describe("lireRedirect", () => {
  it("renvoie un texte vers sa page de bibliothèque, query comprise", () => {
    // 1 : Berakhot (Talmud), un texte à chapitres ; 103 : Tehilim 1.
    expect(lireRedirect("1", undefined, {})).toEqual({
      path: "/bibliotheque/talmud/berakhot",
      query: {},
    });
    expect(lireRedirect("1", "3", { verset: "12" })).toEqual({
      path: "/bibliotheque/talmud/berakhot/3",
      query: { verset: "12" },
    });
    expect(lireRedirect("103", undefined, {})).toEqual({
      path: "/bibliotheque/tehilim/1",
      query: {},
    });
  });

  it("laisse la vue se rendre dans une chaîne de lecture", () => {
    expect(lireRedirect("1", "3", { session: "ma-chaine" })).toBeNull();
    // Un `?session=` vide ne fait pas une chaîne : on redirige quand même.
    expect(lireRedirect("1", undefined, { session: "" })).not.toBeNull();
  });

  it("laisse la vue afficher « texte introuvable » pour un id inconnu", () => {
    expect(lireRedirect("999999", undefined, {})).toBeNull();
  });

  it("retombe sur la liste des chapitres quand la section n'est pas un nombre", () => {
    expect((lireRedirect("1", "abc", {}) as { path: string }).path).toBe(
      "/bibliotheque/talmud/berakhot",
    );
  });
});
