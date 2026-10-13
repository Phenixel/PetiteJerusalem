import { beforeEach, describe, expect, it } from "vitest";
import {
  inProgressSlugs,
  isFinished,
  progressOf,
  recordFinished,
  recordPosition,
  reloadListening,
  resumePosition,
} from "../services/listeningProgress";

/**
 * Où l'on en est de chaque cours (listeningProgress) : ce qui fait reprendre
 * un cours là où on l'a laissé, et la rangée « Reprendre l'écoute ».
 */

beforeEach(() => {
  localStorage.clear();
  reloadListening();
});

describe("reprise d'un cours", () => {
  it("reprend un peu avant la seconde atteinte", () => {
    recordPosition("a", 600, 1800);
    expect(resumePosition("a")).toBe(597);
    expect(progressOf("a")).toBeCloseTo(1 / 3);
  });

  it("ne reprend pas un cours à peine essayé, ni un cours fini", () => {
    recordPosition("essai", 8, 1800);
    expect(resumePosition("essai")).toBeNull();
    recordPosition("fin", 1790, 1800);
    expect(resumePosition("fin")).toBeNull();
    expect(isFinished("fin")).toBe(true);
  });

  it("garde la coche d'un cours fini qu'on réécoute", () => {
    recordFinished("a", 1800);
    recordPosition("a", 60, 1800);
    expect(isFinished("a")).toBe(true);
  });

  it("survit à un rechargement de la page", () => {
    recordPosition("a", 600, 1800);
    reloadListening();
    expect(resumePosition("a")).toBe(597);
  });

  it("range les cours entamés du plus récent au plus ancien", async () => {
    recordPosition("ancien", 300, 1800);
    await new Promise((r) => setTimeout(r, 5));
    recordPosition("recent", 300, 1800);
    recordPosition("fini", 1800, 1800);
    expect(inProgressSlugs()).toEqual(["recent", "ancien"]);
  });
});
