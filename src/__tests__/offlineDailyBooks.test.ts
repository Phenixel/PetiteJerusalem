import { beforeEach, describe, expect, it, vi } from "vitest";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";

/**
 * Quels textes de la lecture du jour manquent sur l'appareil ?
 *
 * C'est ce calcul qui déclenche la proposition de téléchargement à l'ajout
 * d'un texte, et le rappel affiché quand une lecture du jour ne serait pas
 * lisible hors connexion. Les corpus volumineux sont retirés du binaire natif
 * (scripts/prune-native-bundle.mjs) : eux doivent être téléchargés, alors que
 * les Tehilim, embarqués, sont toujours là.
 */

// L'app native : c'est la seule plateforme où les textes vivent sur l'appareil.
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "ios" }));

const downloaded = new Set<string>();

vi.mock("../services/offlineTextStore", () => ({
  downloadManifest: { value: { files: {} } },
  ensureManifestLoaded: () => Promise.resolve(),
  isDownloaded: (path: string) => downloaded.has(path),
  isDownloadCurrent: (path: string) => downloaded.has(path),
  downloadFile: vi.fn(),
  removeFile: vi.fn(),
}));

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

function entryOfType(type: string): TextStudyJsonEntry {
  const entry = allTexts.find((txt) => String(txt.type) === type);
  if (!entry) throw new Error(`Aucune entrée de type ${type} dans le catalogue`);
  return entry;
}

const psalm = entryOfType("Tehilim");
const parasha = entryOfType("Tanakh");
const tractate = entryOfType("Talmud Bavli");

describe("disponibilité hors ligne des textes de la lecture du jour", () => {
  beforeEach(() => downloaded.clear());

  it("considère les Tehilim disponibles : leur fichier est embarqué dans l'app", async () => {
    const { isEntryAvailableOffline, missingBooksForEntries } = await import(
      "../services/offlineLibraryService"
    );
    expect(isEntryAvailableOffline(psalm)).toBe(true);
    expect(missingBooksForEntries([psalm])).toEqual([]);
  });

  it("signale un texte d'un corpus téléchargeable tant qu'il n'est pas sur l'appareil", async () => {
    const { isEntryAvailableOffline, missingBooksForEntries } = await import(
      "../services/offlineLibraryService"
    );
    expect(isEntryAvailableOffline(parasha)).toBe(false);
    const missing = missingBooksForEntries([parasha]);
    expect(missing).toHaveLength(1);
    expect(missing[0].path).toContain("/texts/tanakh/");
  });

  it("ne propose plus un livre déjà téléchargé", async () => {
    const { isEntryAvailableOffline, missingBooksForEntries, bookForEntry } = await import(
      "../services/offlineLibraryService"
    );
    downloaded.add(bookForEntry(parasha)!.path);
    expect(isEntryAvailableOffline(parasha)).toBe(true);
    expect(missingBooksForEntries([parasha])).toEqual([]);
  });

  it("ne propose qu'une fois un livre partagé par plusieurs entrées", async () => {
    const { missingBooksForEntries } = await import("../services/offlineLibraryService");
    // Deux textes du même traité : un seul fichier à télécharger.
    const sameTractate = allTexts.filter((txt) => txt.link === tractate.link);
    expect(sameTractate.length).toBeGreaterThan(0);
    expect(missingBooksForEntries([...sameTractate, tractate])).toHaveLength(1);
  });
});
