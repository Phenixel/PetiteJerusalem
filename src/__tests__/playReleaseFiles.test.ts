// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PHONE_AAB, WEAR_AAB, playReleaseFiles, shipWatchAppsFromEnv } from "../../scripts/play-release-files.mjs";

/**
 * Deux pièges vivent dans le champ `releaseFiles` de la publication Play, et
 * tous deux n'apparaissent qu'au moment de publier, une fois le build fait et
 * la clé de signature sortie. De là ces tests, qui les voient avant.
 *
 * La forme : l'action `r0adkll/upload-google-play` découpe son entrée sur la
 * virgule, et rien d'autre :
 *
 *     core.getInput('releaseFiles')?.split(',')?.filter(x => x !== '')
 *
 * puis passe le résultat à fast-glob. Un bloc YAML multiligne devient donc un
 * motif unique portant un retour à la ligne, qui ne correspond à aucun
 * fichier ; une espace après la virgule fait le même effet. Le tag v3.9.3 est
 * mort là-dessus.
 *
 * Le contenu : l'AAB de la montre n'a sa place dans la release que si la fiche
 * Play déclare le facteur de forme « Wear OS ». Sinon Google refuse la release
 * entière en validant l'édition, sur un « Internal error encountered » qui ne
 * dit pas lequel des deux artefacts le gêne. Le tag v3.9.4 est mort là-dessus.
 */

const WORKFLOW = ".github/workflows/deploy-android.yml";

describe("les AAB envoyés dans la release Play Store", () => {
  it("n'emporte que le téléphone tant que la fiche n'a pas le facteur de forme Wear OS", () => {
    expect(playReleaseFiles({ shipWatchApps: false })).toBe(PHONE_AAB);
  });

  it("emporte les deux artefacts une fois la fiche prête", () => {
    expect(playReleaseFiles({ shipWatchApps: true })).toBe(`${PHONE_AAB},${WEAR_AAB}`);
  });

  it("tient sur une ligne, virgules seules, sans blanc autour", () => {
    for (const shipWatchApps of [false, true]) {
      const value = playReleaseFiles({ shipWatchApps });
      expect(value).not.toMatch(/\s/);
      for (const path of value.split(",")) {
        expect(path).toBe(path.trim());
        expect(path).not.toBe("");
      }
    }
  });

  it("ne prend la montre que sur un « true » franc", () => {
    expect(shipWatchAppsFromEnv({ SHIP_WATCH_APPS: "true" })).toBe(true);
    expect(shipWatchAppsFromEnv({ SHIP_WATCH_APPS: " TRUE\n" })).toBe(true);
    for (const value of ["false", "1", "yes", "", undefined]) {
      expect(shipWatchAppsFromEnv({ SHIP_WATCH_APPS: value })).toBe(false);
    }
    expect(shipWatchAppsFromEnv({})).toBe(false);
  });
});

describe("le workflow de publication Android", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");

  it("passe la valeur calculée à l'action, sans la réécrire à la main", () => {
    const line = workflow.split("\n").find((candidate) => candidate.trim().startsWith("releaseFiles:"));
    expect(line, `aucun « releaseFiles: » dans ${WORKFLOW}`).toBeDefined();
    expect(line!.trim()).toBe("releaseFiles: ${{ steps.aabs.outputs.files }}");
  });

  it("calcule cette valeur avec le script, sous la variable de repo", () => {
    expect(workflow).toContain("node scripts/play-release-files.mjs");
    expect(workflow).toContain("SHIP_WATCH_APPS: ${{ vars.SHIP_WATCH_APPS }}");
  });

  it("construit et archive l'AAB de la montre dans tous les cas", () => {
    expect(workflow).toContain(":wear:bundleRelease");
    expect(workflow).toContain(WEAR_AAB);
  });
});
