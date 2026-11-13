import { describe, expect, it, vi } from "vitest";
import type { ParcoursData } from "../services/parcours/model";

/**
 * L'écriture du compte (services/parcours/cloud.ts). Firestore refuse tout
 * champ `undefined` et rejette alors l'écriture entière : une journée cochée
 * portait `skipped: undefined`, et la coche ne partait jamais au compte, sans
 * bruit (la suite de bout en bout l'a montré, e2e/firebase/parcours.spec.ts).
 */

const setDoc = vi.fn();

class FieldPath {
  segments: string[];
  constructor(...segments: string[]) {
    this.segments = segments;
  }
}

vi.mock("../firebase/lazy", () => ({
  loadFirestore: () =>
    Promise.resolve({
      db: {},
      sdk: { doc: (_db: unknown, ...path: string[]) => path.join("/"), setDoc, FieldPath },
    }),
}));

const { writeAccountEntries } = await import("../services/parcours/cloud");
const { setTaskDone } = await import("../services/parcours/actions");
const { emptyParcours } = await import("../services/parcours/model");

/** Les chemins des champs `undefined` d'une valeur. */
function undefinedPaths(value: unknown, path = ""): string[] {
  if (value === undefined) return [path];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => undefinedPaths(child, `${path}.${key}`));
}

describe("l'écriture du compte", () => {
  it("une journée cochée ne porte aucun champ vide", () => {
    const data = setTaskDone(
      emptyParcours(),
      { id: "t", objectiveId: "t", kind: "text", moment: "morning", weekly: false },
      "2026-10-14",
      true,
    );
    expect(undefinedPaths(data.days["2026-10-14"])).toEqual([]);
  });

  it("n'envoie jamais de champ undefined, même d'une entrée qui en porte", async () => {
    const data: ParcoursData = emptyParcours();
    data.days["2026-10-14"] = { done: ["t"], skipped: undefined, at: 1 };
    await writeAccountEntries("uid", data, { objectives: [], days: ["2026-10-14"] });
    const [, payload] = setDoc.mock.calls[0] as [unknown, unknown];
    expect(undefinedPaths(payload)).toEqual([]);
    expect(payload).toMatchObject({ days: { "2026-10-14": { done: ["t"], at: 1 } } });
  });
});
