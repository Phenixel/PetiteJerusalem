import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Les 150 psaumes vivent dans un seul fichier (`tehilim.json`, 1,2 Mo). Le
 * Tehilim du jour en ouvre jusqu'à neuf d'un coup : chacun relisait et
 * reparsait le fichier entier. Il ne se lit plus qu'une fois, et chaque
 * psaume garde son propre texte.
 */

const { fetchTextResponse } = vi.hoisted(() => ({ fetchTextResponse: vi.fn() }));
vi.mock("../services/offlineTextStore", () => ({ fetchTextResponse }));

const tehilim = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => [String(i + 1), { he: [`verset du psaume ${i + 1}`] }]),
);

const psalm = (n: number) =>
  ({
    id: String(n),
    name: `Psaume ${n}`,
    link: `Psalms.${n}`,
    livre: "Tehilim",
    type: "Tehilim",
    totalSections: 1,
  }) as never;

describe("lecture d'un fichier partagé par plusieurs textes", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchTextResponse.mockReset();
  });

  it("lit tehilim.json une seule fois pour les neuf psaumes du jour", async () => {
    fetchTextResponse.mockImplementation(async () => new Response(JSON.stringify(tehilim)));
    const { loadText } = await import("../services/textService");

    const contents = await Promise.all(Array.from({ length: 9 }, (_, i) => loadText(psalm(i + 1))));
    expect(fetchTextResponse).toHaveBeenCalledTimes(1);
    contents.forEach((content, i) =>
      expect(content.sections[0].he).toEqual([`verset du psaume ${i + 1}`]),
    );

    // Le psaume suivant, ouvert ensuite dans le lecteur : toujours rien à relire.
    await loadText(psalm(3));
    expect(fetchTextResponse).toHaveBeenCalledTimes(1);
  });

  it("ne garde pas un échec : l'essai suivant relit le fichier", async () => {
    fetchTextResponse.mockResolvedValueOnce(new Response("", { status: 503 }));
    fetchTextResponse.mockResolvedValueOnce(new Response(JSON.stringify(tehilim)));
    const { loadText } = await import("../services/textService");

    await expect(loadText(psalm(1))).rejects.toThrow();
    const content = await loadText(psalm(1));
    expect(content.sections[0].he).toEqual(["verset du psaume 1"]);
    expect(fetchTextResponse).toHaveBeenCalledTimes(2);
  });
});
