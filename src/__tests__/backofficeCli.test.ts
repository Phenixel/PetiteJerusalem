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
  releaseAnnouncement,
  releaseAnnouncementId,
  slugify,
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
    expect(announcementFields({ ...base, resolved: true }).resolved).toBe(false);
    expect(announcementFields({ ...base, kind: "incident", resolved: true }).resolved).toBe(true);
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
