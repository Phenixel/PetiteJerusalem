import { describe, expect, it } from "vitest";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";
import { ZMANIM_STRINGS } from "../content/zmanimSeoStrings";
import type { SeoLocale } from "../content/seoLocales";
import { cityInSentence, cityName } from "../content/zmanimCities";

/**
 * Les titres de page passent par `t()`, et vue-i18n lit le `|` comme un
 * séparateur de pluriel : « Petite Jérusalem | Partager… » ressortait tronqué
 * à « Petite Jérusalem », sur toutes les pages rendues par l'application et
 * dans tout ce qui les partage. Les messages du bloc `seo` échappent donc leur
 * barre (`{'|'}`), et ce test le tient : la barre revient à l'affichage, et
 * rien n'est coupé.
 */
const LOCALES = { fr, en, he } as Record<string, { seo: Record<string, string> }>;

/**
 * Le prérendu et l'application posent le titre de la même page : s'ils
 * divergent, un moteur voit un titre dans le HTML servi et un autre après
 * exécution du script, et choisit lui-même. Ces couples-là doivent donc rester
 * identiques, langue par langue.
 *
 * Les gabarits de ville sont comparés sur de vrais noms, et non sur le
 * gabarit brut : en hébreu la préposition se colle au nom (avec un maqaf
 * devant un nom latin), elle voyage donc avec la valeur au runtime et non
 * dans le gabarit. Ce qu'on veut tenir, c'est ce que le visiteur lit.
 */
const CITIES = ["Lyon", "Jérusalem", "Charleroi"];

const ALIGNED: {
  key: string;
  prerendered: (locale: SeoLocale, city: string) => string;
  /** La valeur passée au gabarit runtime, telle que la vue la calcule. */
  value?: (locale: SeoLocale, city: string) => string;
}[] = [
  { key: "zmanimTitle", prerendered: (l) => ZMANIM_STRINGS[l].hubTitle },
  { key: "zmanimDescription", prerendered: (l) => ZMANIM_STRINGS[l].hubDescription },
  {
    key: "zmanimCityTitle",
    prerendered: (l, city) => ZMANIM_STRINGS[l].cityTitle(cityName(city, l)),
    value: (l, city) => cityInSentence(city, l),
  },
  {
    key: "zmanimCityDescription",
    prerendered: (l, city) => ZMANIM_STRINGS[l].cityDescription(cityName(city, l)),
    value: (l, city) => cityInSentence(city, l),
  },
  { key: "calendarTitle", prerendered: (l) => ZMANIM_STRINGS[l].calendarTitle },
];

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

    it(`dit la même chose que le prérendu (${code})`, () => {
      // L'apostrophe typographique des locales et l'apostrophe droite du
      // prérendu disent la même chose : c'est le texte qu'on compare, pas la
      // fonte. Le gabarit {city}, lui, reste tel quel des deux côtés.
      const same = (value: string) => value.split("{'|'}").join("|").split("\u2019").join("'");
      // La clé est portée dans le message comparé : un échec dit tout de
      // suite laquelle a divergé.
      const locale = code as SeoLocale;
      const runtime: string[] = [];
      const prerendered: string[] = [];
      for (const entry of ALIGNED) {
        // Une clé absente ressort comme une ligne vide dans la comparaison
        // finale, qui nomme la clé : inutile d'assertion séparée.
        const raw = messages.seo[entry.key] ?? "";
        if (!entry.value) {
          runtime.push(`${entry.key}: ${same(raw)}`);
          prerendered.push(`${entry.key}: ${same(entry.prerendered(locale, ""))}`);
          continue;
        }
        for (const city of CITIES) {
          const filled = raw.split("{city}").join(entry.value(locale, city));
          runtime.push(`${entry.key} (${city}): ${same(filled)}`);
          prerendered.push(`${entry.key} (${city}): ${same(entry.prerendered(locale, city))}`);
        }
      }
      expect(runtime).toEqual(prerendered);
    });

    it(`ne laisse aucune barre nue dans le bloc seo (${code})`, () => {
      const bare = Object.entries(messages.seo).filter(([, value]) =>
        value.split("{'|'}").join("").includes("|"),
      );
      expect(bare.map(([key]) => key)).toEqual([]);
    });
  }
});
