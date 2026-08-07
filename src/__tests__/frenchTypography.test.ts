import { describe, expect, it } from "vitest";
import fr from "../locales/fr";

/**
 * Ponctuation double française : `!` `?` `;` `:` et les guillemets « » veulent
 * une espace **insécable** (fine avant ! ? ;, normale avant : et dans « »).
 *
 * Ce n'est pas qu'une question de règle : avec une espace ordinaire, le signe
 * part seul à la ligne dès que la largeur s'y prête — un « ! » orphelin sous
 * « Bravo, tout est lu pour aujourd'hui » sur l'écran d'un téléphone. Aucune
 * taille de police ne met à l'abri de ça ; l'espace insécable, si.
 *
 * Le bloc `seo` est hors jeu : ses chaînes ne sont pas affichées, elles
 * partent dans les balises meta.
 */

const NARROW_NBSP = " ";
const NBSP = " ";

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value] as [string, string]] : flatten(value, path);
  });
}

describe("typographie française", () => {
  const entries = flatten(fr as Messages).filter(([path]) => !path.startsWith("seo."));

  it("n'a aucune espace sécable avant une ponctuation double", () => {
    // Le `|` des pluriels vue-i18n est un séparateur, pas de la ponctuation.
    const offenders = entries.filter(([, value]) =>
      value.replace(/ \| /g, "").match(/ [!?;:»]/),
    );
    expect(
      offenders.map(([path, value]) => `${path} → ${value}`),
      `Utilisez « ${NARROW_NBSP} » (U+202F) avant ! ? ; et « ${NBSP} » (U+00A0) avant : et dans « »`,
    ).toEqual([]);
  });

  it("n'a aucune espace sécable après un guillemet ouvrant", () => {
    const offenders = entries.filter(([, value]) => value.includes("« "));
    expect(offenders.map(([path]) => path)).toEqual([]);
  });
});
