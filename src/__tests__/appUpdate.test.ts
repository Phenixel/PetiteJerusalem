import { describe, it, expect } from "vitest";
import { isOutdated, shouldOfferUpdate } from "../services/appUpdateService";

// Comparaison de versions du chemin iOS (sur Android, l'API In-App Updates
// du Play Store compare elle-même).
describe("isOutdated", () => {
  it("compare les segments numériquement, pas alphabétiquement", () => {
    expect(isOutdated("3.9.0", "3.10.0")).toBe(true);
    expect(isOutdated("3.10.0", "3.9.0")).toBe(false);
    expect(isOutdated("2.0.0", "10.0.0")).toBe(true);
  });

  it("ne signale rien quand le binaire installé est à jour ou en avance", () => {
    expect(isOutdated("3.4.0", "3.4.0")).toBe(false);
    expect(isOutdated("3.4.1", "3.4.0")).toBe(false);
    expect(isOutdated("4.0.0", "3.9.9")).toBe(false);
  });

  it("complète les segments manquants par zéro", () => {
    expect(isOutdated("3.4", "3.4.1")).toBe(true);
    expect(isOutdated("3.4.0", "3.4")).toBe(false);
    expect(isOutdated("3", "3.0.1")).toBe(true);
  });

  it("tolère le préfixe v et la queue de `git describe`", () => {
    expect(isOutdated("3.4.0", "v3.5.0")).toBe(true);
    // Build local entre deux tags : 7 commits après v3.4.0, donc pas périmé
    // face à la release v3.4.0 déjà publiée.
    expect(isOutdated("v3.4.0-7-gabc1234", "3.4.0")).toBe(false);
    expect(isOutdated("v3.4.0-7-gabc1234", "3.5.0")).toBe(true);
  });

  it("s'abstient quand une version est illisible (pas de faux positif)", () => {
    expect(isOutdated("", "3.4.0")).toBe(false);
    expect(isOutdated("3.4.0", "")).toBe(false);
    expect(isOutdated("3.4.0", "latest")).toBe(false);
  });
});

describe("shouldOfferUpdate", () => {
  const check = { outdated: true, version: "42", installed: "3.4.0" };

  it("propose une mise à jour disponible et jamais refusée", () => {
    expect(shouldOfferUpdate(check, null)).toBe(true);
  });

  it("respecte le refus de la version proposée, pas celui d'une ancienne", () => {
    expect(shouldOfferUpdate(check, "42")).toBe(false);
    expect(shouldOfferUpdate(check, "41")).toBe(true);
  });

  it("ne propose rien quand le store dit l'app à jour", () => {
    expect(shouldOfferUpdate({ ...check, outdated: false }, null)).toBe(false);
  });

  it("s'abstient sans identifiant de version : le refus ne serait pas mémorisable", () => {
    expect(shouldOfferUpdate({ ...check, version: null }, null)).toBe(false);
    expect(shouldOfferUpdate({ ...check, version: null }, "42")).toBe(false);
  });
});
