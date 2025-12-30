import { describe, it, expect } from "vitest";
import fr from "../locales/fr.json";
import en from "../locales/en.json";
import he from "../locales/he.json";

type TranslationObject = { [key: string]: string | TranslationObject };

/**
 * Récupère toutes les clés d'un objet de traduction de manière récursive
 * @param obj L'objet de traduction
 * @param prefix Le préfixe pour les clés imbriquées
 * @returns Un Set de toutes les clés sous forme "parent.enfant.cle"
 */
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

/**
 * Trouve les clés présentes dans source mais absentes dans target
 */
function findMissingKeys(source: Set<string>, target: Set<string>): string[] {
  return Array.from(source).filter((key) => !target.has(key));
}

describe("i18n translations", () => {
  const locales = {
    fr: fr as TranslationObject,
    en: en as TranslationObject,
    he: he as TranslationObject,
  };

  const allKeys = {
    fr: getAllKeys(locales.fr),
    en: getAllKeys(locales.en),
    he: getAllKeys(locales.he),
  };

  const referenceLocale = "fr";
  const referenceKeys = allKeys[referenceLocale];

  it("devrait avoir les mêmes clés dans toutes les langues", () => {
    const errors: string[] = [];

    for (const [locale, keys] of Object.entries(allKeys)) {
      if (locale === referenceLocale) continue;

      const missingInLocale = findMissingKeys(referenceKeys, keys);
      const extraInLocale = findMissingKeys(keys, referenceKeys);

      if (missingInLocale.length > 0) {
        errors.push(
          `\n❌ Clés manquantes dans '${locale}':\n  - ${missingInLocale.join("\n  - ")}`,
        );
      }

      if (extraInLocale.length > 0) {
        errors.push(
          `\n⚠️ Clés en trop dans '${locale}' (absentes de '${referenceLocale}'):\n  - ${extraInLocale.join("\n  - ")}`,
        );
      }
    }

    expect(errors, `Incohérences dans les traductions:${errors.join("")}`).toHaveLength(0);
  });

  it("devrait avoir au moins une clé de traduction", () => {
    expect(referenceKeys.size).toBeGreaterThan(0);
  });

  it("ne devrait pas avoir de valeurs vides", () => {
    const emptyValues: string[] = [];

    function checkEmpty(obj: TranslationObject, locale: string, prefix = "") {
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof value === "object" && value !== null) {
          checkEmpty(value as TranslationObject, locale, fullKey);
        } else if (value === "") {
          emptyValues.push(`${locale}:${fullKey}`);
        }
      }
    }

    for (const [locale, obj] of Object.entries(locales)) {
      checkEmpty(obj, locale);
    }

    expect(
      emptyValues,
      `Valeurs de traduction vides:\n  - ${emptyValues.join("\n  - ")}`,
    ).toHaveLength(0);
  });
});
