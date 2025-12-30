import { describe, it, expect } from "vitest";
import fr from "../locales/fr.json";
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
});
