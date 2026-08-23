import { describe, expect, it } from "vitest";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";

/**
 * Les titres de page passent par `t()`, et vue-i18n lit le `|` comme un
 * séparateur de pluriel : « Petite Jérusalem | Partager… » ressortait tronqué
 * à « Petite Jérusalem », sur toutes les pages rendues par l'application et
 * dans tout ce qui les partage. Les messages du bloc `seo` échappent donc leur
 * barre (`{'|'}`), et ce test le tient : la barre revient à l'affichage, et
 * rien n'est coupé.
 */
const LOCALES = { fr, en, he } as Record<string, { seo: Record<string, string> }>;

describe("titres de page", () => {
  for (const [code, messages] of Object.entries(LOCALES)) {
    const i18n = createI18n({ legacy: false, locale: code, messages: { [code]: messages } });
    // Les paramètres de gabarit sont remplis : ce qu'on vérifie ici est la
    // barre, pas l'interpolation.
    const params = { city: "Ville", festival: "Fête" };
    const fill = (value: string) =>
      value
        .split("{'|'}")
        .join("|")
        .split("{city}")
        .join(params.city)
        .split("{festival}")
        .join(params.festival);

    it(`rend la barre des titres en entier (${code})`, () => {
      const withPipe = Object.entries(messages.seo).filter(([, value]) => value.includes("{'|'}"));
      expect(withPipe.length).toBeGreaterThan(5);
      for (const [key, raw] of withPipe) {
        const rendered = i18n.global.t(`seo.${key}`, params);
        expect(rendered).toBe(fill(raw));
        expect(rendered).toContain(" | ");
      }
    });

    it(`ne laisse aucune barre nue dans le bloc seo (${code})`, () => {
      const bare = Object.entries(messages.seo).filter(([, value]) =>
        value.split("{'|'}").join("").includes("|"),
      );
      expect(bare.map(([key]) => key)).toEqual([]);
    });
  }
});
