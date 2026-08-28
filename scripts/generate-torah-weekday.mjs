/**
 * Écrit src/datas/torahWeekday.json : la lecture de la Torah du lundi et du
 * jeudi matin, paracha par paracha.
 *
 * Lancer avec : node scripts/generate-torah-weekday.mjs
 *
 * Ce que l'on lit ces matins-là n'est pas la 1re montée du Chabbat : c'est le
 * début de la paracha, découpé en trois montées (Cohen, Lévi, Israël), dont la
 * fin varie d'une paracha à l'autre. Les bornes viennent de @hebcal/leyning
 * (dépendance de développement, jamais embarquée dans l'application) ; on n'en
 * garde ici que le nombre de versets de chaque montée et ses références, de
 * quoi découper le fichier de la paracha (public/texts/tanakh/<id>.json, dont
 * les versets se suivent depuis le premier).
 *
 * Chaque lecture est vérifiée : elle commence au premier verset de la paracha,
 * ses trois montées se suivent sans trou, et le tout tient dans la paracha.
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parshiot } from "@hebcal/core";
import { getWeekdayReading, calculateNumVerses, lookupParsha } from "@hebcal/leyning";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/datas/torahWeekday.json");

/** "26:1" → [26, 1] */
const refParts = (ref) => ref.split(":").map(Number);

/** Le verset qui suit, dans le même chapitre ou au début du suivant. */
const follows = (end, next) => {
  const [ec, ev] = refParts(end);
  const [nc, nv] = refParts(next);
  return (nc === ec && nv === ev + 1) || (nc === ec + 1 && nv === 1);
};

const readings = {};
for (const parsha of parshiot) {
  const weekday = getWeekdayReading(parsha);
  const full = lookupParsha(parsha);
  const aliyot = [1, 2, 3].map((n) => weekday[String(n)]);
  if (aliyot.some((a) => !a)) throw new Error(`${parsha} : lecture de semaine incomplète`);

  // Elle ouvre la paracha, et ses trois montées se suivent d'un trait.
  const start = full.fullkriyah["1"][0];
  if (aliyot[0].b !== start) {
    throw new Error(`${parsha} : la lecture commence en ${aliyot[0].b}, la paracha en ${start}`);
  }
  for (let i = 1; i < aliyot.length; i++) {
    if (!follows(aliyot[i - 1].e, aliyot[i].b)) {
      throw new Error(`${parsha} : trou entre ${aliyot[i - 1].e} et ${aliyot[i].b}`);
    }
  }

  readings[parsha] = aliyot.map((a) => ({ n: calculateNumVerses(a), from: a.b, to: a.e }));
}

// Une paracha par ligne : le fichier se relit d'un coup d'oeil.
const body = Object.entries(readings)
  .map(([parsha, aliyot]) => `  ${JSON.stringify(parsha)}: ${JSON.stringify(aliyot)}`)
  .join(",\n");
writeFileSync(OUT, `{\n${body}\n}\n`);
const total = Object.values(readings).reduce(
  (sum, aliyot) => sum + aliyot.reduce((s, a) => s + a.n, 0),
  0,
);
console.log(`torahWeekday.json : ${Object.keys(readings).length} parachiot, ${total} versets.`);
