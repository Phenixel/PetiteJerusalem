import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseTefilaBlocks } from "../services/textService";

/**
 * Les fichiers de textes sont lus par des applications plus anciennes qu'eux.
 *
 * Le site publie les textes et le code ensemble, mais ils n'arrivent pas
 * ensemble chez le lecteur : l'app native télécharge les fichiers depuis le
 * site (le bundle ne les embarque pas, voir prune-native-bundle.mjs) pendant
 * que son code reste celui de la version installée, qui peut dater de
 * plusieurs mois. Une version ancienne lit donc les fichiers d'aujourd'hui
 * avec le calendrier et l'analyseur d'hier.
 *
 * Ce qu'elle ne comprend pas d'une condition `when`, une clé d'occasion que
 * son calendrier ne pose pas, une syntaxe que son analyseur ne découpe pas,
 * elle le tient pour faux et masque le passage : un bout de prière disparaît,
 * au milieu d'une bénédiction, sans que rien ne le dise. C'est ce qui est
 * arrivé au tahanoun et à la conclusion de la bénédiction de Jérusalem.
 *
 * Un champ qu'elle ne connaît pas, en revanche, elle l'ignore, et affiche le
 * passage. D'où la règle que ces tests tiennent (voir
 * docs/compatibilite-textes.md) :
 *
 *  - `when` ne porte qu'une clé simple, sans « ! » ni « | » ;
 *  - ce qui retire un passage passe par `unless`, que les anciennes versions
 *    ignorent, et qui les laisse donc afficher le texte ordinaire ;
 *  - tout paragraphe garde un fragment d'hébreu sans condition : quoi qu'une
 *    version comprenne des conditions, elle ne rend jamais un paragraphe
 *    mutilé.
 */

const DOSSIER = resolve(__dirname, "../../public/texts/tefila");
const FICHIERS = readdirSync(DOSSIER).filter((nom) => nom.endsWith(".json"));

/** Toutes les conditions d'un fichier, `when` et `unless`, où qu'elles soient. */
function conditionsOf(valeur: unknown, champ: "when" | "unless", trouvees: string[] = []) {
  if (Array.isArray(valeur)) {
    for (const item of valeur) conditionsOf(item, champ, trouvees);
  } else if (valeur && typeof valeur === "object") {
    const objet = valeur as Record<string, unknown>;
    if (typeof objet[champ] === "string") trouvees.push(objet[champ] as string);
    for (const item of Object.values(objet)) conditionsOf(item, champ, trouvees);
  }
  return trouvees;
}

const lire = (nom: string): unknown => JSON.parse(readFileSync(resolve(DOSSIER, nom), "utf8"));

describe.each(FICHIERS)("%s", (nom) => {
  const brut = lire(nom);

  it("n'écrit dans when qu'une clé simple, lisible par les versions publiées", () => {
    // « !teshuva » et « teshuva|hoshana-rabba » ne sont découpés que depuis
    // la v3.10.1 : une version antérieure cherche la chaîne entière parmi
    // les occasions du jour, ne la trouve pas, et masque le passage.
    const complexes = conditionsOf(brut, "when").filter(
      (when) => when.includes("!") || when.includes("|"),
    );
    expect(complexes).toEqual([]);
  });

  it("garde dans chaque paragraphe de l'hébreu sans condition", () => {
    // Un paragraphe dont tous les fragments portent un `when` disparaît en
    // entier chez qui ne comprend aucune de ces clés ; un paragraphe dont la
    // conclusion seule en porte un s'arrête au milieu. Le texte ordinaire
    // n'a donc pas de `when` : c'est l'ajout du jour qui en a un, et
    // l'exception qui le retire, `unless`, n'est lue que par les versions
    // qui la connaissent.
    const mutiles: string[] = [];
    for (const bloc of parseTefilaBlocks((brut as { blocks?: unknown }).blocks)) {
      for (const paragraphe of bloc.paragraphs ?? []) {
        if (paragraphe.when) continue; // Le paragraphe entier est un ajout du jour.
        const hebreu = paragraphe.runs.filter((run) => run.kind === "he");
        // Sans hébreu, rien à mutiler ; un fragment sans condition, ou sous
        // la condition du bloc lui-même (le compte du 'Omer de ce soir, dans
        // le bloc de ce soir), tient le paragraphe : qui masque l'un masque
        // l'autre.
        const tenu = hebreu.some((run) => !run.when || run.when === bloc.when);
        if (hebreu.length === 0 || tenu) continue;
        const debut = hebreu[0].kind === "he" ? hebreu[0].text.slice(0, 40) : "";
        mutiles.push(`${bloc.label || bloc.anchor} : ${debut}`);
      }
    }
    expect(mutiles).toEqual([]);
  });

  it("explique la conclusion qu'elles ne savent pas retirer", () => {
    // Une conclusion remplacée le jour dit (« Hamélekh hakadoch ») laisse
    // l'ordinaire sous `unless`. Le lecteur à jour la retire ; une version
    // publiée, qui ignore `unless`, affiche les deux, et aucune clé ne peut
    // l'en empêcher : son calendrier ne sait pas nommer « hors des dix
    // jours ». Elle doit alors lire entre les deux la règle du sidour
    // imprimé, la didascalie que didascalieDeRemplacement pose pour elle.
    const sans: string[] = [];
    for (const bloc of parseTefilaBlocks((brut as { blocks?: unknown }).blocks)) {
      for (const paragraphe of bloc.paragraphs ?? []) {
        paragraphe.runs.forEach((run, i) => {
          if (run.kind !== "he" || !run.unless || run.when) return;
          const cle = run.unless;
          const suite = paragraphe.runs.slice(i + 1);
          // Une paire de remplacement : la variante du jour suit l'ordinaire.
          if (!suite.some((r) => r.kind === "he" && r.when === cle)) return;
          const explique = suite.some(
            (r) => r.kind === "rubric" && r.when === cle && r.unless === cle,
          );
          if (!explique) sans.push(`${bloc.label || bloc.anchor} : ${run.text.slice(0, 30)}`);
        });
      }
    }
    expect(sans).toEqual([]);
  });
});
