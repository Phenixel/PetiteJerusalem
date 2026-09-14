import { describe, expect, it } from "vitest";
import {
  buildNotionPage,
  FeedbackValidationError,
  isEmail,
  parseFeedback,
} from "../../functions/src/feedbackNotion";

/**
 * Le formulaire de support, côté serveur : ce que le client envoie doit
 * arriver dans les bonnes colonnes de la base Notion, avec leurs noms exacts
 * (dont l'espace final de « De quoi s’agit il ? »), et rien d'invalide ne
 * doit passer.
 */

const valid = {
  kind: "bug",
  otherKind: "",
  details: "  Le bouton ne répond pas.  ",
  contact: "",
  support: "app",
  platform: "ios",
  version: "1.4.2 (37)",
};

describe("parseFeedback", () => {
  it("normalise un envoi valide", () => {
    expect(parseFeedback(valid)).toEqual({
      kind: "bug",
      otherKind: "",
      details: "Le bouton ne répond pas.",
      contact: "",
      support: "app",
      platform: "ios",
      version: "1.4.2 (37)",
    });
  });

  it("exige des détails", () => {
    expect(() => parseFeedback({ ...valid, details: "   " })).toThrow(FeedbackValidationError);
    expect(() => parseFeedback({ ...valid, details: undefined })).toThrow(FeedbackValidationError);
  });

  it("refuse un type, un support ou une plateforme inconnus", () => {
    expect(() => parseFeedback({ ...valid, kind: "praise" })).toThrow(FeedbackValidationError);
    expect(() => parseFeedback({ ...valid, kind: "toString" })).toThrow(FeedbackValidationError);
    expect(() => parseFeedback({ ...valid, support: "tv" })).toThrow(FeedbackValidationError);
    expect(() => parseFeedback({ ...valid, platform: "windows" })).toThrow(FeedbackValidationError);
  });

  it("refuse un texte trop long", () => {
    expect(() => parseFeedback({ ...valid, details: "x".repeat(2001) })).toThrow(
      FeedbackValidationError,
    );
  });

  it("ne garde la précision « autre » que pour ce type", () => {
    expect(parseFeedback({ ...valid, kind: "bug", otherKind: "un mot" }).otherKind).toBe("");
    expect(parseFeedback({ ...valid, kind: "other", otherKind: " un mot " }).otherKind).toBe(
      "un mot",
    );
  });

  it("tolère un envoi qui n'est pas un objet", () => {
    expect(() => parseFeedback(null)).toThrow(FeedbackValidationError);
    expect(() => parseFeedback("bonjour")).toThrow(FeedbackValidationError);
  });
});

describe("isEmail", () => {
  it("distingue un email d'un numéro", () => {
    expect(isEmail("vous@exemple.fr")).toBe(true);
    expect(isEmail("06 12 34 56 78")).toBe(false);
    expect(isEmail("+33612345678")).toBe(false);
    expect(isEmail("pas un email")).toBe(false);
  });
});

describe("buildNotionPage", () => {
  it("range chaque champ dans sa colonne", () => {
    const page = buildNotionPage(parseFeedback({ ...valid, contact: "vous@exemple.fr" }));
    expect(page.parent).toEqual({
      type: "data_source_id",
      data_source_id: "26b35db9-0d4d-80a2-8db8-000b67a4b989",
    });
    const properties = page.properties as Record<string, unknown>;
    expect(properties["Donnez des détails"]).toEqual({
      title: [{ type: "text", text: { content: "Le bouton ne répond pas." } }],
    });
    expect(properties["De quoi s’agit il ? "]).toEqual({ multi_select: [{ name: "Bug" }] });
    expect(properties.Support).toEqual({ select: { name: "Application" } });
    expect(properties.Plateforme).toEqual({ select: { name: "iOS" } });
    expect(properties.Version).toEqual({
      rich_text: [{ type: "text", text: { content: "1.4.2 (37)" } }],
    });
    expect(properties["Pour vous contacter"]).toEqual({ email: "vous@exemple.fr" });
    expect(properties).not.toHaveProperty("Téléphone");
    expect(properties).not.toHaveProperty("Si autre");
  });

  it("met un numéro dans la colonne Téléphone", () => {
    const page = buildNotionPage(parseFeedback({ ...valid, contact: "06 12 34 56 78" }));
    const properties = page.properties as Record<string, unknown>;
    expect(properties["Téléphone"]).toEqual({ phone_number: "06 12 34 56 78" });
    expect(properties).not.toHaveProperty("Pour vous contacter");
  });

  it("omet ce qui est vide et garde la précision « autre »", () => {
    const page = buildNotionPage(
      parseFeedback({
        ...valid,
        kind: "other",
        otherKind: "Une question",
        version: "",
        support: "web",
        platform: "web",
      }),
    );
    const properties = page.properties as Record<string, unknown>;
    expect(properties["De quoi s’agit il ? "]).toEqual({ multi_select: [{ name: "Autre" }] });
    expect(properties["Si autre"]).toEqual({
      rich_text: [{ type: "text", text: { content: "Une question" } }],
    });
    expect(properties.Support).toEqual({ select: { name: "Web" } });
    expect(properties).not.toHaveProperty("Version");
    expect(properties).not.toHaveProperty("Pour vous contacter");
  });
});
