// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Le plugin de dictée (@capacitor-community/speech-recognition) ne connaît
 * que CocoaPods ; l'app iOS se construit avec Swift Package Manager. Sans le
 * paquet que fabrique scripts/spm-speech-recognition.mjs, `cap sync` laisse
 * le plugin de côté et l'app s'installe sans micro, sans que rien ne le dise
 * avant l'appareil.
 *
 * Le test travaille sur une copie du plugin réellement installé : si une mise
 * à jour change sa forme (la classe, la macro, les méthodes), le script échoue
 * ici, avant de casser le build iOS de la CI.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, "scripts", "spm-speech-recognition.mjs");
const INSTALLED = join(ROOT, "node_modules", "@capacitor-community", "speech-recognition");

/** Une copie du plugin installé, sans le paquet que le script a pu y écrire. */
function pluginCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), "pj-speech-"));
  cpSync(join(INSTALLED, "ios", "Plugin"), join(dir, "ios", "Plugin"), { recursive: true });
  return dir;
}

describe("spm-speech-recognition", () => {
  let dir: string;
  let packageSwift: string;
  let bridge: string;

  beforeAll(() => {
    dir = pluginCopy();
    execFileSync("node", [SCRIPT, dir]);
    packageSwift = readFileSync(join(dir, "Package.swift"), "utf8");
    bridge = readFileSync(
      join(dir, "ios", "Sources", "SpeechRecognitionPlugin", "SpeechRecognitionBridge.swift"),
      "utf8",
    );
  });

  it("écrit un paquet Swift qui vise la classe copiée", () => {
    expect(packageSwift).toContain('name: "CapacitorCommunitySpeechRecognition"');
    expect(packageSwift).toContain('path: "ios/Sources/SpeechRecognitionPlugin"');
    expect(packageSwift).toContain("capacitor-swift-pm");
    const copied = join(dir, "ios", "Sources", "SpeechRecognitionPlugin", "SpeechRecognition.swift");
    expect(readFileSync(copied, "utf8")).toContain("@objc(SpeechRecognition)");
  });

  it("déclare au pont le nom JS et toutes les méthodes de la macro", () => {
    expect(bridge).toContain("extension SpeechRecognition: CAPBridgedPlugin");
    expect(bridge).toContain('public var jsName: String { "SpeechRecognition" }');
    const objc = readFileSync(join(INSTALLED, "ios", "Plugin", "Plugin.m"), "utf8");
    const declared = [...objc.matchAll(/CAP_PLUGIN_METHOD\(\s*(\w+)/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(5);
    for (const method of declared) {
      expect(bridge).toContain(`CAPPluginMethod(name: "${method}", returnType: CAPPluginReturnPromise)`);
    }
    // Les méthodes qu'on appelle depuis speechRecognition.ts, nommément.
    for (const method of ["available", "start", "stop", "requestPermissions", "removeAllListeners"]) {
      expect(declared).toContain(method);
    }
  });

  it("est idempotent : un second passage ne change rien", () => {
    execFileSync("node", [SCRIPT, dir]);
    expect(readFileSync(join(dir, "Package.swift"), "utf8")).toBe(packageSwift);
  });

  it("ne touche pas à un Package.swift que le plugin livrerait lui-même", () => {
    const own = pluginCopy();
    writeFileSync(join(own, "Package.swift"), "// le paquet du plugin\n");
    execFileSync("node", [SCRIPT, own]);
    expect(readFileSync(join(own, "Package.swift"), "utf8")).toBe("// le paquet du plugin\n");
    expect(existsSync(join(own, "ios", "Sources"))).toBe(false);
  });
});
