import { describe, it, expect } from "vitest";
import { isOutdated } from "../services/appUpdateService";

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
