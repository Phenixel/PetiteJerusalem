// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BackofficeInputError,
  announcementFields,
  audioExtension,
  downloadUrl,
  localizedText,
  parseKind,
  parseList,
  pollFields,
  releaseAnnouncement,
  releaseAnnouncementId,
  searchCatalog,
  slugify,
  texteFields,
  versionOf,
} from "../../scripts/lib/backoffice.mjs";

/**
 * Le backoffice en ligne de commande (scripts/admin.mjs) : il doit écrire
 * exactement ce qu'écrirait l'interface, avec les mêmes refus.
 */

const base = {
  kind: "news",
  title: { fr: "Titre" },
  body: { fr: "Texte" },
  link: "",
  linkLabel: { fr: "" },
  version: "",
  resolved: false,
  published: true,
  notify: false,
};

describe("parseKind", () => {
  it("accepte les mots français et anglais", () => {
    expect(parseKind("nouveaute")).toBe("news");
    expect(parseKind("Mise-a-jour")).toBe("release");
    expect(parseKind("incident")).toBe("incident");
    expect(parseKind("question")).toBe("question");
    expect(parseKind("autre")).toBeNull();
  });
});

describe("announcementFields", () => {
  it("exige le titre et le texte en français", () => {
    expect(() => announcementFields({ ...base, title: { fr: "" } })).toThrow(BackofficeInputError);
    expect(() => announcementFields({ ...base, body: { fr: "" } })).toThrow(BackofficeInputError);
  });

  it("refuse un lien qui n'est ni une page de l'app ni une adresse https", () => {
    expect(() => announcementFields({ ...base, link: "bibliotheque" })).toThrow(/Le lien/);
    expect(announcementFields({ ...base, link: "/bibliotheque" }).link?.url).toBe("/bibliotheque");
    expect(announcementFields({ ...base, link: "https://a.fr" }).link?.url).toBe("https://a.fr");
  });

  it("ne garde la version que pour une mise à jour, « résolu » que pour un incident", () => {
    expect(announcementFields({ ...base, version: "3.11.0" }).version).toBeNull();
    expect(announcementFields({ ...base, kind: "release", version: "3.11.0" }).version).toBe(
      "3.11.0",
    );
    expect(announcementFields({ ...base, kind: "incident", version: "3.11.0" }).version).toBeNull();
    expect(announcementFields({ ...base, resolved: true }).resolved).toBe(false);
    expect(announcementFields({ ...base, kind: "incident", resolved: true }).resolved).toBe(true);
  });

  it("garde la version du correctif d'un incident à part, et la veut X.Y.Z", () => {
    const incident = { ...base, kind: "incident", fixedIn: "v3.11.1" };
    expect(announcementFields(incident).fixedIn).toBe("3.11.1");
    expect(announcementFields(incident).version).toBeNull();
    expect(announcementFields({ ...base, fixedIn: "3.11.1" }).fixedIn).toBeNull();
    expect(() => announcementFields({ ...incident, fixedIn: "bientôt" })).toThrow(
      BackofficeInputError,
    );
  });

  it("ne garde un sondage que sur une question", () => {
    const poll = pollFields({ choices: ["Oui", "Non"] }, null);
    expect(announcementFields({ ...base, kind: "question", poll }).poll).toBe(poll);
    expect(announcementFields({ ...base, poll }).poll).toBeNull();
  });

  it("n'écrit jamais notifiedAt ni publishedAt : ils appartiennent au serveur", () => {
    const fields = announcementFields(base);
    expect(fields).not.toHaveProperty("notifiedAt");
    expect(fields).not.toHaveProperty("publishedAt");
  });
});

describe("localizedText", () => {
  it("omet les langues vides", () => {
    expect(localizedText(" Bonjour ", "", "  ")).toEqual({ fr: "Bonjour" });
    expect(localizedText("Bonjour", "Hello")).toEqual({ fr: "Bonjour", en: "Hello" });
  });
});

describe("notes de version", () => {
  const body = `## Français
Nouveautés
- Le sidour est complet.

## English
What's new
- The siddur is complete.

## עברית
חדש
- הסידור מלא.
`;

  it("lit la version d'un tag", () => {
    expect(versionOf("v3.11.0")).toBe("3.11.0");
    expect(versionOf("3.11.0")).toBe("3.11.0");
    expect(versionOf("web-v3.11.0")).toBeNull();
    expect(releaseAnnouncementId("3.11.0")).toBe("release-v3.11.0");
  });

  it("fait une information « Mise à jour » dans les trois langues", () => {
    const a = releaseAnnouncement("3.11.0", body);
    expect(a?.kind).toBe("release");
    expect(a?.version).toBe("3.11.0");
    expect(a?.title.fr).toContain("3.11.0");
    expect(a?.body.fr).toContain("Le sidour est complet.");
    expect(a?.body.en).toContain("The siddur is complete.");
    expect(a?.body.he).toContain("הסידור מלא.");
  });

  it("une release sans titres de langue est tout en français", () => {
    const a = releaseAnnouncement("3.11.0", "Nouveautés\n- Une chose.");
    expect(Object.keys(a?.body ?? {})).toEqual(["fr"]);
  });

  it("pas d'information pour une release sans texte", () => {
    expect(releaseAnnouncement("3.11.0", "")).toBeNull();
  });

  it("le résultat passe la validation du backoffice", () => {
    const a = releaseAnnouncement("3.11.0", body);
    expect(() =>
      announcementFields({ ...a, linkLabel: { fr: "" }, published: true, notify: false }),
    ).not.toThrow();
  });
});

describe("chiourim", () => {
  it("slugifie comme le studio", () => {
    expect(slugify("  Berakhot 3 : le Chema du soir ")).toBe("Berakhot-3-:-le-Chema-du-soir");
    expect(slugify("L'heure du Chema ?")).toBe("Lheure-du-Chema-");
  });

  it("n'accepte que les formats audio du studio", () => {
    expect(audioExtension("cours.MP3")).toBe("mp3");
    expect(() => audioExtension("cours.flac")).toThrow(BackofficeInputError);
  });

  it("découpe une liste de catégories", () => {
    expect(parseList(" Halakha, Michna ,, ")).toEqual(["Halakha", "Michna"]);
  });

  it("forme l'adresse de téléchargement permanente", () => {
    expect(downloadUrl("b", "chiourim/x/audio.mp3", "t")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/b/o/chiourim%2Fx%2Faudio.mp3?alt=media&token=t",
    );
    expect(downloadUrl("b", "a.mp3", "t", "localhost:8472")).toMatch(/^http:\/\/localhost:8472\//);
  });
});

describe("sondages", () => {
  it("lit les choix, leur image (adresse ou fichier) et leurs traductions", () => {
    const poll = pollFields(
      {
        choices: ["Bleu|https://exemple.fr/bleu.jpg", "Vert|vert.png", "Rouge"],
        choicesEn: ["Blue", "Green"],
        multiple: true,
      },
      null,
    )!;
    expect(poll.multiple).toBe(true);
    expect(poll.closed).toBe(false);
    expect(poll.options.map((o) => o.label)).toEqual([
      { fr: "Bleu", en: "Blue" },
      { fr: "Vert", en: "Green" },
      { fr: "Rouge" },
    ]);
    expect(poll.options.map((o) => o.image)).toEqual([
      "https://exemple.fr/bleu.jpg",
      { file: "vert.png" },
      null,
    ]);
    expect(new Set(poll.options.map((o) => o.id)).size).toBe(3);
  });

  it("garde l'identifiant (donc les votes) et l'image d'un choix dont le libellé ne change pas", () => {
    const existing = {
      options: [
        { id: "aaaa", label: { fr: "Bleu" }, image: "https://exemple.fr/bleu.jpg" },
        { id: "bbbb", label: { fr: "Vert" }, image: null },
      ],
      multiple: false,
      closed: false,
    };
    const poll = pollFields({ choices: ["Vert", "Bleu", "Jaune"] }, existing)!;
    expect(poll.options.map((o) => o.id).slice(0, 2)).toEqual(["bbbb", "aaaa"]);
    expect(poll.options[1].image).toBe("https://exemple.fr/bleu.jpg");
    expect(["aaaa", "bbbb"]).not.toContain(poll.options[2].id);
  });

  it("clôt ou rouvre sans toucher aux choix, et se retire", () => {
    const existing = {
      options: [{ id: "a1b2", label: { fr: "Oui" }, image: null }],
      multiple: false,
      closed: false,
    };
    expect(pollFields({ closed: true }, existing)).toEqual({ ...existing, closed: true });
    expect(pollFields({ remove: true }, existing)).toBeNull();
    expect(pollFields({}, null)).toBeNull();
    expect(() => pollFields({ closed: true }, null)).toThrow(BackofficeInputError);
  });

  it("refuse moins de deux choix, plus de huit, ou un choix vide", () => {
    expect(() => pollFields({ choices: ["Seul"] }, null)).toThrow(BackofficeInputError);
    expect(() =>
      pollFields({ choices: Array.from({ length: 9 }, (_, i) => `C${i}`) }, null),
    ).toThrow(BackofficeInputError);
    expect(() => pollFields({ choices: ["Oui", "|image.png"] }, null)).toThrow(
      BackofficeInputError,
    );
  });
});

/**
 * Le livre d'un chiour (`--livre`, `--chapitre`) : les champs texteId et
 * texteChapitre que lit src/services/chiourTexte.ts.
 */
describe("texteFields", () => {
  const catalog = [
    { id: 1, type: "Talmud Bavli", name: "ברכות (Berakhot)", livre: "זרעים (Zeraim)" },
    { id: 103, type: "Tehilim", name: "Tehilim 1", livre: "ספר 1 (Sefer 1)" },
    { id: 345, type: "Sidour", name: "שחרית (Chaharit)", livre: "סידור (Sidour)" },
  ];

  it("rattache un livre, et oublie le chapitre de l'ancien", () => {
    expect(texteFields({ livre: "1" }, catalog)).toEqual({ texteId: 1, texteChapitre: null });
    expect(texteFields({ livre: "1" }, catalog, { texteId: 1, texteChapitre: 3 })).toEqual({
      texteId: 1,
    });
    expect(texteFields({ livre: "1", chapitre: "3" }, catalog)).toEqual({
      texteId: 1,
      texteChapitre: 3,
    });
  });

  it("accepte le chapitre 0, l'introduction d'une porte", () => {
    expect(texteFields({ chapitre: "0" }, catalog, { texteId: 1 })).toEqual({ texteChapitre: 0 });
  });

  it("retire le livre et son chapitre", () => {
    expect(texteFields({ livre: "aucun" }, catalog, { texteId: 1, texteChapitre: 2 })).toEqual({
      texteId: null,
      texteChapitre: null,
    });
    expect(texteFields({ chapitre: "" }, catalog, { texteId: 1, texteChapitre: 2 })).toEqual({
      texteChapitre: null,
    });
  });

  it("refuse un livre inconnu, un chapitre sans livre ou hors bornes", () => {
    expect(() => texteFields({ livre: "9999" }, catalog)).toThrow(BackofficeInputError);
    expect(() => texteFields({ chapitre: "2" }, catalog)).toThrow(BackofficeInputError);
    expect(() => texteFields({ livre: "1", chapitre: "-1" }, catalog)).toThrow(
      BackofficeInputError,
    );
    expect(() => texteFields({ livre: "1", chapitre: "2.5" }, catalog)).toThrow(
      BackofficeInputError,
    );
  });

  it("refuse un chapitre à un psaume ou une tefila", () => {
    expect(() => texteFields({ livre: "103", chapitre: "1" }, catalog)).toThrow(
      BackofficeInputError,
    );
    expect(() => texteFields({ livre: "345", chapitre: "1" }, catalog)).toThrow(
      BackofficeInputError,
    );
  });

  it("ne touche à rien sans option", () => {
    expect(texteFields({}, catalog, { texteId: 1, texteChapitre: 2 })).toEqual({});
  });

  it("trouve un livre par son nom, accents ignorés", () => {
    expect(searchCatalog(catalog, "berakhot").map((e) => e.id)).toEqual([1]);
    expect(searchCatalog(catalog, "zéraim").map((e) => e.id)).toEqual([1]);
    expect(searchCatalog(catalog, "")).toHaveLength(3);
  });

  it("trouve un livre quelle que soit sa graphie latine", () => {
    const parachiot = [
      { id: 270, name: "Vayetze", livre: "Berechit" },
      { id: 312, name: "Ki Tetze", livre: "Devarim" },
      { id: 404, name: "שער הבטחון (Chaar Habita'hon)", livre: "חובות הלבבות (Hovot Halévavot)" },
    ];
    expect(searchCatalog(parachiot, "Vayetse").map((e) => e.id)).toEqual([270]);
    expect(searchCatalog(parachiot, "Ki Tétsé").map((e) => e.id)).toEqual([312]);
    expect(searchCatalog(parachiot, "shaar habitahon").map((e) => e.id)).toEqual([404]);
    expect(searchCatalog(catalog, "Berachot").map((e) => e.id)).toEqual([1]);
    expect(searchCatalog(catalog, "Shaharit").map((e) => e.id)).toEqual([345]);
  });
});
