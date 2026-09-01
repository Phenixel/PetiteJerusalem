import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `public/texts/manifest.json` porte l'empreinte de chaque texte servi par le
 * site. C'est par elle qu'un appareil qui garde un texte téléchargé apprend
 * que le site en sert une autre version, et la reprend (offlineTextStore,
 * `outdatedDownloads`).
 *
 * D'où ce test : un texte corrigé sans que le manifeste suive ne serait
 * corrigé que pour qui n'a rien téléchargé. Le build régénère le manifeste,
 * mais la dérive se verrait alors au déploiement plutôt qu'ici.
 */

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(racine, "scripts", "texts-manifest.mjs");
const MANIFEST = join(racine, "public", "texts", "manifest.json");

describe("manifeste des textes", () => {
  it("correspond aux fichiers de public/texts", () => {
    // Le script sait le dire mieux que nous : il refait les empreintes.
    expect(() => execFileSync(process.execPath, [SCRIPT, "--check"])).not.toThrow();
  });

  it("couvre les textes du sidour, qui changent le plus souvent", () => {
    const { files } = JSON.parse(readFileSync(MANIFEST, "utf-8")) as {
      files: Record<string, string>;
    };
    for (const office of ["chaharit", "minha", "arvit"]) {
      expect(files[`/texts/tefila/${office}.json`]).toMatch(/^[0-9a-f]{12}$/);
    }
    // Le manifeste ne se décrit pas lui-même : son empreinte changerait à
    // chaque écriture, sans fin.
    expect(files["/texts/manifest.json"]).toBeUndefined();
  });
});
