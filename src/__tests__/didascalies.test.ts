import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Une didascalie dit ce qui se fait, ici et maintenant : une posture, une
 * voix, qui parle, ce qu'on reprend quand on a oublié. Deux choses n'y ont
 * pas leur place.
 *
 * D'abord l'application elle-même. Lui expliquer qu'un ajout « apparaît à sa
 * place » ou qu'il est « à la couleur du thème », c'est lui parler de
 * l'écran alors qu'il prie. Ce qui se voit n'a pas besoin d'être dit.
 *
 * Ensuite les jours d'absence. Un bloc porteur d'un `when` est retiré du fil
 * les jours où son occasion n'est pas active (voir TextReadingPage et
 * `saidToday` dans LiturgyText) : la consigne qui énumère ces jours-là ne
 * peut être lue que le jour où elle ne s'applique pas. Elle occupe l'écran
 * pour ne rien apprendre. La condition se porte dans le `when`, pas dans la
 * phrase.
 */

const DIR = resolve(__dirname, "../../public/texts/tefila");

/** Le vocabulaire par lequel une didascalie se met à parler de l'écran. */
const META = [
  "couleur du thème",
  "à leur place",
  "cette section",
  "n'apparaît pas",
  "passages indiqués",
  "theme color",
  "does not appear",
  "indicated passages",
];

type Node = { [key: string]: unknown };

/** Toutes les didascalies d'un fichier : `rubric`, `halakha` et les `r` des fils. */
function consignes(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) consignes(item, out);
    return out;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Node)) {
      const isConsigne = key === "rubric" || key === "halakha" || key === "r";
      if (isConsigne && value && typeof value === "object") {
        const fr = (value as Node).fr;
        const en = (value as Node).en;
        if (typeof fr === "string") out.push(fr);
        if (typeof en === "string") out.push(en);
      } else {
        consignes(value, out);
      }
    }
  }
  return out;
}

const fichiers = readdirSync(DIR).filter((name) => name.endsWith(".json"));

describe("didascalies des textes de tefila", () => {
  it("ne parlent jamais de l'application au lecteur", () => {
    const offenders: string[] = [];
    for (const name of fichiers) {
      const contenu = JSON.parse(readFileSync(resolve(DIR, name), "utf-8"));
      for (const texte of consignes(contenu)) {
        for (const mot of META) {
          if (texte.includes(mot)) offenders.push(`${name} → ${texte}`);
        }
      }
    }
    expect(
      offenders,
      "Une didascalie décrit ce qui se dit, pas ce que l'écran affiche",
    ).toEqual([]);
  });

  it("ne rappellent pas les jours où le bloc est de toute façon retiré", () => {
    // Un bloc `when` absent ce jour-là n'est pas affiché : énumérer ses jours
    // d'absence dans sa propre didascalie ne s'adresse à personne.
    const offenders: string[] = [];
    for (const name of fichiers) {
      const contenu = JSON.parse(readFileSync(resolve(DIR, name), "utf-8"));
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
          for (const item of node) walk(item);
          return;
        }
        if (!node || typeof node !== "object") return;
        const bloc = node as Node;
        if (typeof bloc.when === "string") {
          for (const texte of consignes({ ...bloc, blocks: undefined })) {
            if (/ne se di[st] pas|ne se disent pas|ne dit pas|is not said|are not said/i.test(texte)) {
              offenders.push(`${name} (when: ${bloc.when}) → ${texte}`);
            }
          }
        }
        for (const value of Object.values(bloc)) walk(value);
      };
      walk(contenu);
    }
    expect(offenders, "La condition se porte dans le `when`, pas dans la phrase").toEqual([]);
  });
});
