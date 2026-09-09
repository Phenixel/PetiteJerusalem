// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * L'action `r0adkll/upload-google-play` découpe son entrée `releaseFiles` sur
 * la virgule, et rien d'autre :
 *
 *     core.getInput('releaseFiles')?.split(',')?.filter(x => x !== '')
 *
 * puis passe le résultat à fast-glob. Un bloc YAML multiligne devient donc un
 * motif unique portant un retour à la ligne, qui ne correspond à aucun
 * fichier ; une espace après la virgule fait le même effet. Le tag v3.9.3 est
 * mort là-dessus, huit minutes après son départ, alors que les deux AAB
 * étaient signés et prêts sur le disque.
 *
 * L'erreur ne se voit qu'en publiant : de là ce test, qui la voit avant.
 */

const WORKFLOW = ".github/workflows/deploy-android.yml";

/** La valeur de `releaseFiles:` telle que l'action la recevra. */
function releaseFilesInput(): string {
  const line = readFileSync(WORKFLOW, "utf8")
    .split("\n")
    .find((candidate) => candidate.trim().startsWith("releaseFiles:"));
  expect(line, `aucun « releaseFiles: » dans ${WORKFLOW}`).toBeDefined();
  return line!.trim().slice("releaseFiles:".length);
}

describe("releaseFiles de la publication Play Store", () => {
  it("tient sur une ligne : un bloc « | » ou « > » ne serait qu'un seul motif", () => {
    expect(releaseFilesInput().trim()).not.toMatch(/^[|>]/);
  });

  it("sépare les chemins par une virgule seule, sans espace autour", () => {
    for (const path of releaseFilesInput().trim().split(",")) {
      expect(path, "un blanc autour de la virgule casse le glob").toBe(path.trim());
      expect(path).not.toBe("");
    }
  });

  it("publie les deux artefacts de la fiche, le téléphone et la montre", () => {
    const paths = releaseFilesInput().trim().split(",");
    expect(paths).toEqual([
      "android/app/build/outputs/bundle/release/app-release.aab",
      "android/wear/build/outputs/bundle/release/wear-release.aab",
    ]);
  });
});
