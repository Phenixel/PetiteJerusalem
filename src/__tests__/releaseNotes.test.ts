// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  defaultReleaseNotes,
  releaseNotesFor,
  splitReleaseNotes,
} from "../../scripts/release-notes.mjs";

/**
 * Les « Nouveautés » des deux stores viennent du corps de la release GitHub du
 * tag. Écrit en trois sections (`## Français`, `## English`, `## עברית`), il
 * donne à chaque langue de chaque fiche son propre texte ; sans ces titres, il
 * reste du français, comme avant. Lu par scripts/prepare-whatsnew.mjs (Play)
 * et scripts/appstore-listing.mjs (App Store).
 */

const TRILINGUAL = [
  "## Français",
  "Nouveautés",
  "- Le profil est refait.",
  "",
  "## English",
  "What's new",
  "- The profile has been redesigned.",
  "",
  "## עברית",
  "חדש",
  "- הפרופיל עוצב מחדש.",
  "",
].join("\r\n");

describe("splitReleaseNotes", () => {
  it("donne à chaque langue le texte de sa section, en texte brut", () => {
    expect(splitReleaseNotes(TRILINGUAL)).toEqual({
      fr: "Nouveautés\n• Le profil est refait.",
      en: "What's new\n• The profile has been redesigned.",
      he: "חדש\n• הפרופיל עוצב מחדש.",
    });
  });

  it("garde un corps sans titre de langue pour le français, comme avant", () => {
    expect(splitReleaseNotes("Nouveautés\n- Un seul texte")).toEqual({
      fr: "Nouveautés\n• Un seul texte",
    });
  });

  it("ne prend pas un titre ordinaire pour un titre de langue", () => {
    expect(splitReleaseNotes("## Nouveautés\n- Un\n## Corrections\n- Deux")).toEqual({
      fr: "Nouveautés\n• Un\nCorrections\n• Deux",
    });
  });

  it("reconnaît les titres sans casse ni accent, et dans une autre langue", () => {
    const notes = splitReleaseNotes("# francais\nA\n### ANGLAIS\nB\n## Hébreu\nC");
    expect(notes).toEqual({ fr: "A", en: "B", he: "C" });
  });

  it("ignore ce qui précède la première section, et les sections vides", () => {
    expect(splitReleaseNotes("Brouillon\n## Français\nA\n## English\n\n")).toEqual({ fr: "A" });
  });

  it("ne rend rien pour un corps vide", () => {
    expect(splitReleaseNotes("")).toEqual({});
    expect(splitReleaseNotes(undefined)).toEqual({});
  });
});

describe("releaseNotesFor", () => {
  const notes = splitReleaseNotes(TRILINGUAL);

  it("sert chaque locale des deux stores, iw-IL du Play Store compris", () => {
    expect(releaseNotesFor(notes, "fr-FR")).toContain("Le profil est refait");
    expect(releaseNotesFor(notes, "en-US")).toContain("redesigned");
    expect(releaseNotesFor(notes, "he")).toContain("הפרופיל");
    expect(releaseNotesFor(notes, "iw-IL")).toContain("הפרופיל");
  });

  it("rend null pour une langue sans section, l'appelant choisit le repli", () => {
    expect(releaseNotesFor({ fr: "A" }, "en-US")).toBeNull();
  });
});

describe("defaultReleaseNotes", () => {
  it("traduit la phrase par défaut, et retombe sur l'anglais", () => {
    expect(defaultReleaseNotes("fr-FR")).toBe("Correction de bugs mineurs.");
    expect(defaultReleaseNotes("iw-IL")).toBe("תיקוני באגים קלים.");
    expect(defaultReleaseNotes("pt-BR")).toBe("Minor bug fixes.");
  });
});
