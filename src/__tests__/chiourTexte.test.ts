import { describe, expect, it } from "vitest";
import type { Chiour } from "../models/models";
import {
  chapitreKind,
  chiourTexte,
  chiourimOfTexte,
  hasChapitres,
  serieTexte,
  texteOf,
  texteRoute,
  texteTitle,
} from "../services/chiourTexte";

/**
 * Le lien d'un cours vers le texte de la bibliothèque qu'il étudie
 * (ChiourDoc.texteId, ChiourDoc.texteChapitre) : l'adresse où il mène, au
 * chapitre près, et les cours d'un texte dans l'ordre du texte.
 */

const chiour = (partial: Partial<Chiour> & { slug: string }): Chiour => ({
  name: partial.slug,
  description: "",
  auteur: null,
  categories: [],
  mediaUrl: "https://example.org/a.mp3",
  niveau: null,
  auteurId: null,
  serieId: null,
  episode: null,
  duration: null,
  addedAt: null,
  texteId: null,
  texteChapitre: null,
  ...partial,
});

// Identifiants du catalogue (src/datas/textStudies.json).
const BERAKHOT_TALMUD = 1;
const AVOT_MICHNA = 78;
const VAYETZE = 270;
const YEHOSHUA = 318;
const TEHILIM_1 = 103;
const CHAHARIT = 345;
const CHAAR_HABITAHON = 404;
const PELE_YOETS_ALEPH = 420;

describe("le texte d'un cours", () => {
  it("retrouve l'entrée du catalogue, et ignore un identifiant inconnu", () => {
    expect(texteOf(BERAKHOT_TALMUD)?.name).toContain("Berakhot");
    expect(texteOf(999999)).toBeNull();
    expect(texteOf(null)).toBeNull();
    expect(chiourTexte(chiour({ slug: "a", texteId: 999999, texteChapitre: 2 }))).toBeNull();
  });

  it("mène à la page du chapitre d'un texte en plusieurs pages", () => {
    const entry = texteOf(BERAKHOT_TALMUD)!;
    expect(texteRoute(entry, 3)).toEqual({ path: "/bibliotheque/talmud/berakhot/3" });
    expect(texteRoute(entry, null)).toEqual({ path: "/bibliotheque/talmud/berakhot" });
    expect(texteRoute(texteOf(AVOT_MICHNA)!, 1).path).toBe("/bibliotheque/michna/avot/1");
  });

  it("mène au bloc d'un texte d'une seule page par ?chapitre=", () => {
    const route = texteRoute(texteOf(YEHOSHUA)!, 3);
    expect(route.path).toBe("/bibliotheque/tanakh/yehoshua");
    expect(route.query).toEqual({ chapitre: "3" });
  });

  it("ne précise pas de chapitre d'un psaume ou d'une tefila", () => {
    expect(hasChapitres(texteOf(TEHILIM_1)!)).toBe(false);
    expect(hasChapitres(texteOf(CHAHARIT)!)).toBe(false);
    expect(texteRoute(texteOf(CHAHARIT)!, 4).query).toBeUndefined();
    expect(chiourTexte(chiour({ slug: "a", texteId: CHAHARIT, texteChapitre: 4 }))?.chapitre).toBe(
      null,
    );
  });

  it("dit ce qu'est le chapitre", () => {
    expect(chapitreKind(texteOf(VAYETZE)!, 2)).toBe("aliya");
    expect(chapitreKind(texteOf(YEHOSHUA)!, 2)).toBe("chapter");
    expect(chapitreKind(texteOf(BERAKHOT_TALMUD)!, 2)).toBe("chapter");
  });

  it("mène au chapitre du moussar, l'introduction d'une porte comprise", () => {
    const porte = texteOf(CHAAR_HABITAHON)!;
    expect(texteRoute(porte, 4).path).toBe("/bibliotheque/moussar/chaar-habitahon/4");
    expect(texteRoute(porte, 0).path).toBe("/bibliotheque/moussar/chaar-habitahon/0");
    expect(chapitreKind(porte, 0)).toBe("introduction");
    expect(chapitreKind(porte, 4)).toBe("chapter");
    expect(
      chiourTexte(chiour({ slug: "a", texteId: CHAAR_HABITAHON, texteChapitre: 0 }))?.chapitre,
    ).toBe(0);
    const pele = texteOf(PELE_YOETS_ALEPH)!;
    expect(chapitreKind(pele, 11)).toBe("topic");
    expect(texteRoute(pele, 11).path).toBe("/bibliotheque/moussar/pele-yoets-aleph/11");
  });

  it("nomme le texte dans l'alphabet du lecteur", () => {
    expect(texteTitle(texteOf(BERAKHOT_TALMUD)!, "fr")).toBe("Talmud Berakhot");
    expect(texteTitle(texteOf(VAYETZE)!, "fr")).toBe("Paracha Vayetze");
    expect(texteTitle(texteOf(BERAKHOT_TALMUD)!, "he")).toBe("ברכות");
  });
});

describe("les cours d'un texte", () => {
  const list = [
    chiour({ slug: "c3", texteId: BERAKHOT_TALMUD, texteChapitre: 3 }),
    chiour({ slug: "tout", texteId: BERAKHOT_TALMUD }),
    chiour({ slug: "c1-ep2", texteId: BERAKHOT_TALMUD, texteChapitre: 1, episode: 2 }),
    chiour({ slug: "c1-ep1", texteId: BERAKHOT_TALMUD, texteChapitre: 1, episode: 1 }),
    chiour({ slug: "ailleurs", texteId: AVOT_MICHNA, texteChapitre: 1 }),
  ];

  it("suivent l'ordre du texte, ceux du livre entier d'abord", () => {
    expect(chiourimOfTexte(list, BERAKHOT_TALMUD).map((c) => c.slug)).toEqual([
      "tout",
      "c1-ep1",
      "c1-ep2",
      "c3",
    ]);
  });

  it("mettent le chapitre ouvert en tête", () => {
    expect(chiourimOfTexte(list, BERAKHOT_TALMUD, 3).map((c) => c.slug)).toEqual([
      "c3",
      "tout",
      "c1-ep1",
      "c1-ep2",
    ]);
  });

  it("donnent à une série le livre de la plupart de ses épisodes", () => {
    expect(serieTexte(list.slice(0, 4))?.id).toBe(BERAKHOT_TALMUD);
    expect(
      serieTexte([
        chiour({ slug: "a", texteId: AVOT_MICHNA }),
        chiour({ slug: "b" }),
        chiour({ slug: "c" }),
      ]),
    ).toBeNull();
  });
});
