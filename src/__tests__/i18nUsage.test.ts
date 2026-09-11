import { describe, it, expect } from "vitest";
import fr from "../locales/fr";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TranslationObject = { [key: string]: string | TranslationObject };

function getAllKeys(obj: TranslationObject, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === "object" && value !== null) {
      const nestedKeys = getAllKeys(value as TranslationObject, fullKey);
      nestedKeys.forEach((k) => keys.add(k));
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

function getSourceFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git") {
        getSourceFiles(filePath, fileList);
      }
    } else {
      if (
        (file.endsWith(".vue") || file.endsWith(".ts") || file.endsWith(".js")) &&
        !file.endsWith(".d.ts") &&
        !file.includes("test") && // Avoid checking test files themselves
        !file.includes("spec")
      ) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

describe("i18n usage", () => {
  const definedKeys = getAllKeys(fr as TranslationObject);
  const srcDir = path.resolve(__dirname, "..");
  const files = getSourceFiles(srcDir);

  it("should have all used keys defined in fr.json", () => {
    const missingKeys: { file: string; key: string }[] = [];
    const usedKeys = new Set<string>();

    // Regex to capture t("key") or $t('key')
    // Matches: t("key"), t('key'), $t("key"), $t('key')
    // Also matches in template {{ t('key') }} or :label="t('key')"
    const regex = /\b(?:t|\$t)\s*\(\s*["']([^"']+)["']\s*\)/g;

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      let match;
      while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        usedKeys.add(key);
        // Basic check: if the key contains dynamic parts (e.g. ${...}), skipping might be safer,
        // but for now let's assume simple string literals as per user request.
        // If the key is not in defined keys, it's missing.
        if (!definedKeys.has(key)) {
          // Check if it's a dynamic key pattern we might want to ignore?
          // For now, report everything.
          missingKeys.push({
            file: path.relative(srcDir, filePath),
            key: key,
          });
        }
      }
    });

    if (missingKeys.length > 0) {
      const errorMessage = missingKeys.map((k) => `File: ${k.file} -> Key: ${k.key}`).join("\n");
      console.error("Missing Keys Found:\n" + errorMessage);
      expect(
        missingKeys,
        `Found ${missingKeys.length} missing translation keys:\n${errorMessage}`,
      ).toEqual([]);
    }
  });

  /**
   * Le miroir : aucune clé de fr.ts ne doit rester sans lecteur. Une clé
   * morte se traduit trois fois pour rien, et masque celles qui manquent.
   *
   * Une clé compte comme lue dès que son nom apparaît, entre guillemets,
   * quelque part dans les sources (src, scripts, functions) : `t("…")`,
   * `te("…")`, un `labelKey: "…"` passé plus loin à `t`, un tableau de clés.
   * Les familles atteintes par une clé construite (`t(\`zmanim.names.${key}\`)`)
   * sont listées ici par leur préfixe.
   */
  it("n'a aucune clé de fr.ts sans lecteur dans les sources", () => {
    const DYNAMIC_PREFIXES = [
      "admin.chiourim.filters.",
      "admin.sessions.filters.",
      // Codes d'erreur des services (useToast.errorFromException).
      "errors.",
      "home.sidourNow.names.",
      "moderation.reasons.",
      "occasions.kinds.",
      "occasions.notify.",
      "occasions.reminders.",
      "occasions.when.",
      "profile.appearances.",
      "profile.fontsHebrew.",
      "profile.fontsLatin.",
      "profile.themes.",
      "seo.",
      "studio.form.",
      "textReading.autoScroll.speeds.",
      "textReading.fold.",
      "textReading.kotel.points.",
      "textReading.kotel.rose.",
      "textReading.zman.",
      "zmanim.hints.",
      "zmanim.names.",
      "zmanim.periods.",
      "zmanim.tachanun.",
    ];

    const roots = ["src", "scripts", "functions/src"]
      .map((dir) => path.resolve(srcDir, "..", dir))
      .filter((dir) => fs.existsSync(dir));
    const sources = roots
      .flatMap((dir) => getSourceFiles(dir))
      .filter((file) => !file.includes(`${path.sep}locales${path.sep}`))
      .map((file) => fs.readFileSync(file, "utf-8"))
      .join("\n");
    const quoted = new Set<string>();
    for (const match of sources.matchAll(/["'`]([A-Za-z0-9_.]+)["'`]/g)) quoted.add(match[1]);

    const unused = [...definedKeys].filter(
      (key) => !quoted.has(key) && !DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix)),
    );
    expect(unused, `clés de fr.ts sans lecteur :\n${unused.join("\n")}`).toEqual([]);
  });
});
