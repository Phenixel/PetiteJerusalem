import { describe, expect, it, vi } from "vitest";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Les poids annoncés par corpus (offlineCorpora) servent à prévenir avant de
 * lancer un téléchargement : l'introduction de première ouverture les affiche
 * en face de chaque case à cocher, et c'est sur eux qu'on décide d'emporter le
 * Talmud ou non sur un forfait mobile.
 *
 * Ce sont des ordres de grandeur, mais ils doivent rester vrais : les corpus
 * grossissent au fil des ajouts, et une estimation figée finirait par annoncer
 * 3 Mo pour 8. Ce test les confronte aux fichiers réellement servis.
 */

// Le stockage hors ligne parle au système de fichiers de l'appareil : ici, on
// ne veut que le catalogue et ses tailles.
vi.mock("../services/offlineTextStore", () => ({
  downloadManifest: { value: { files: {} } },
  ensureManifestLoaded: () => Promise.resolve(),
  isDownloaded: () => false,
  isDownloadCurrent: () => false,
  downloadFile: vi.fn(),
  removeFile: vi.fn(),
}));

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public");

/** Marge acceptée entre l'estimation et les fichiers servis. */
const TOLERANCE = 0.2;

describe("poids annoncés des corpus téléchargeables", () => {
  it("reste proche de ce que pèsent vraiment les fichiers de public/texts", async () => {
    const { offlineCorpora } = await import("../services/offlineLibraryService");
    expect(offlineCorpora.length).toBeGreaterThan(0);

    const drifted: string[] = [];
    for (const corpus of offlineCorpora) {
      const real = corpus.books.reduce(
        (sum, book) => sum + statSync(join(publicDir, book.path)).size,
        0,
      );
      const drift = Math.abs(corpus.approxBytes - real) / real;
      if (drift > TOLERANCE) {
        drifted.push(
          `${corpus.key} : annoncé ${corpus.approxBytes} octets, mesuré ${real} (${Math.round(drift * 100)} % d'écart)`,
        );
      }
    }

    expect(drifted, "Mettre à jour CORPUS_META dans offlineLibraryService").toEqual([]);
  });

  it("couvre tous les corpus du catalogue", async () => {
    const { offlineBooks, offlineCorpora } = await import("../services/offlineLibraryService");
    const listed = new Set(offlineCorpora.map((corpus) => corpus.key));
    const missing = [...new Set(offlineBooks.map((book) => book.corpus))].filter(
      (corpus) => !listed.has(corpus),
    );
    expect(missing, "Un corpus sans poids annoncé ne serait pas proposé au téléchargement").toEqual(
      [],
    );
  });
});
