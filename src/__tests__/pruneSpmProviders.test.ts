import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Le build iOS ne doit embarquer aucun SDK de provider OAuth que l'app ne
 * propose pas. Le Package.swift de @capacitor-firebase/authentication les
 * inclut tous (là où CocoaPods partait d'un subspec « Lite » vide) : sans
 * élagage, le SDK Facebook complet part dans l'app en frameworks embarqués.
 *
 * Le test travaille sur une copie du Package.swift réellement installé :
 * si une mise à jour du plugin change la forme du fichier, l'élagage échoue
 * ici, avant de casser le build iOS de la CI.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, "scripts", "prune-spm-providers.mjs");
const INSTALLED = join(ROOT, "node_modules", "@capacitor-firebase", "authentication", "Package.swift");

describe("prune-spm-providers", () => {
  let path: string;
  let pruned: string;

  beforeAll(() => {
    path = join(mkdtempSync(join(tmpdir(), "pj-spm-")), "Package.swift");
    copyFileSync(INSTALLED, path);
    execFileSync("node", [SCRIPT, path]);
    pruned = readFileSync(path, "utf8");
  });

  it("retire toute trace du SDK Facebook", () => {
    expect(pruned).not.toMatch(/facebook/i);
  });

  it("garde GoogleSignIn et sa directive : l'app propose Google", () => {
    expect(pruned).toContain('.product(name: "GoogleSignIn"');
    expect(pruned).toContain('.define("RGCFA_INCLUDE_GOOGLE")');
  });

  it("garde FirebaseAuth, le coeur du plugin", () => {
    expect(pruned).toContain('.product(name: "FirebaseAuth"');
  });

  it("est idempotent : un second passage ne change rien", () => {
    execFileSync("node", [SCRIPT, path]);
    expect(readFileSync(path, "utf8")).toBe(pruned);
  });
});
