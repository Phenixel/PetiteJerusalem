import type { HDate } from "@hebcal/core";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { corpusOf, slugOf, latinName, hubPath } from "../content/etudeTexts";
import type { WeeklyParasha } from "./dailyCycles";
import type { Rubric, TextBlock, TextContent } from "./textService";
import torahWeekdayJson from "../datas/torahWeekday.json";
import {
  computeZmanim,
  hebrewDateFor,
  hebrewDayOf,
  type ZmanKey,
  type ZmanimPlace,
} from "./zmanimService";

/**
 * Le sidour de semaine : ce qui relie ses trois offices entre eux et au reste
 * de l'application. Les textes eux-mêmes vivent dans
 * public/texts/tefila/{chaharit,minha,arvit}.json (voir
 * scripts/build-sidour.mjs) ; ici vivent la lecture de la Torah de la semaine
 * (elle change chaque semaine, le fichier ne peut pas la porter),
 * l'enchaînement de Min'ha vers Arvit, et la plage horaire de l'office en
 * cours (le raccourci de l'accueil).
 */

export type TefilaKey = "chaharit" | "minha" | "arvit";

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

/** L'office du sidour que porte une entrée du catalogue, null sinon. */
export function tefilaOf(entry: TextStudyJsonEntry | null): TefilaKey | null {
  if (!entry || corpusOf(entry) !== "sidour") return null;
  const slug = slugOf(entry);
  return slug === "chaharit" || slug === "minha" || slug === "arvit" ? slug : null;
}

/**
 * L'office qui suit, quand l'enchaînement est naturel : à la fin de Min'ha,
 * Arvit (on les prie souvent l'une après l'autre, autour de la chkia). Pas de
 * lien entre Cha'harit et le reste : la journée les sépare.
 */
const NEXT_TEFILA: Partial<Record<TefilaKey, TefilaKey>> = { minha: "arvit" };

export function nextTefilaEntry(entry: TextStudyJsonEntry | null): TextStudyJsonEntry | null {
  const tefila = tefilaOf(entry);
  const next = tefila ? NEXT_TEFILA[tefila] : undefined;
  if (!next) return null;
  return allTexts.find((e) => corpusOf(e) === "sidour" && slugOf(e) === next) ?? null;
}

/**
 * Le jour hébraïque dont un texte de tefila affiche les occasions (tahanoun,
 * psaume du jour, Yaalé véyavo…), LA règle qui départage date civile et date
 * hébraïque dans le lecteur.
 *
 * Cha'harit et Min'ha sont des offices de la journée : leurs occasions sont
 * celles de la journée civile, sans bascule à la chkia. Le jeudi soir, Min'ha
 * reste celle du jeudi (avec ses supplications et son psaume) ; celle du
 * vendredi ne s'affiche qu'à partir de minuit.
 *
 * Arvit, et tout ce qui n'est pas un office du sidour (brahot, Sli'hot…), se
 * disent une fois la nuit tombée et appartiennent au jour hébraïque qui
 * commence à la chkia : Yaalé véyavo dès la nuit qui ouvre Roch Hodech, Retsé
 * au birkat hamazon du vendredi soir.
 */
export function tefilaHebrewDay(
  place: ZmanimPlace,
  tefila: TefilaKey | null,
  now: Date = new Date(),
): HDate {
  return tefila === "chaharit" || tefila === "minha"
    ? hebrewDayOf(place, now)
    : hebrewDateFor(place, now, now);
}

// ---- Lecture de la Torah de la semaine (lundi et jeudi) -------------------

/** Le nom hébreu d'une entrée : « ברכות (Berakhot) » → « ברכות ». */
const hebrewName = (entry: TextStudyJsonEntry): string =>
  entry.name.replace(/\s*\([^)]*\)\s*$/, "").trim();

/** Les trois montées de la semaine, dans l'ordre où on les appelle. */
const ALIYOT_SEMAINE: Rubric[] = [
  { fr: "Cohen", en: "Kohen", he: "כהן" },
  { fr: "Lévi", en: "Levi", he: "לוי" },
  { fr: "Israël", en: "Yisrael", he: "ישראל" },
];

/**
 * Découpage de la lecture du lundi et du jeudi, paracha par paracha : le
 * nombre de versets de chacune de ses trois montées (voir
 * scripts/generate-torah-weekday.mjs, qui le tient de @hebcal/leyning).
 * Indexé par le nom hebcal de la paracha, celui que porte WeeklyParasha.names.
 */
const TORAH_SEMAINE = torahWeekdayJson as Record<
  string,
  { n: number; from: string; to: string }[]
>;

/**
 * Remplit le marqueur `torahWeekly` de Cha'harit avec la lecture de la Torah
 * de la semaine : le lundi et le jeudi matin, on lit le début de la paracha du
 * Chabbat qui vient, en trois montées (Cohen, Lévi, Israël). Ce début n'est pas
 * la 1re montée du Chabbat : il s'arrête où son propre découpage l'arrête, et
 * les trois montées de la semaine y ont leurs bornes à elles.
 *
 * Les versets se suivent depuis le premier de la paracha : le découpage se lit
 * donc en nombres de versets. Sans découpage connu (paracha absente de la
 * table), on s'en tient à la 1re montée du Chabbat, faute de mieux.
 *
 * Fonction pure : rend un nouveau TextContent, offsets et lignes de section
 * recalculés (marque-pages et translittération raisonnent par index de ligne).
 * Sans marqueur, ou sans montée à lire, le contenu revient inchangé.
 */
export function injectWeeklyTorah(
  content: TextContent,
  parasha: WeeklyParasha,
  parashaContent: TextContent,
): TextContent {
  const section = content.sections[0];
  const markerIndex = section?.blocks?.findIndex((b) => b.torahWeekly) ?? -1;
  if (!section?.blocks || markerIndex < 0) return content;

  const parashaEntry = parasha.entries[0];
  const parashaSection = parashaContent.sections[0];
  const verses = parashaSection?.he ?? [];
  const decoupage = TORAH_SEMAINE[parasha.names[0] ?? ""];
  // Longueurs des trois montées, bornées à ce que le fichier de la paracha
  // porte vraiment ; sans table, la 1re montée du Chabbat tient le rôle.
  const longueurs = decoupage
    ? decoupage.map((aliyah) => aliyah.n)
    : [parashaSection?.blocks?.[0]?.lines.length ?? Math.min(verses.length, 20)];
  if (!parashaEntry || verses.length === 0) return content;

  const name = latinName(parashaEntry);
  const marker = section.blocks[markerIndex];
  const torahBlocks: TextBlock[] = [];
  let lu = 0;
  longueurs.forEach((longueur, i) => {
    const lines = verses.slice(lu, lu + longueur);
    lu += longueur;
    if (lines.length === 0) return;
    const montee = decoupage ? ALIYOT_SEMAINE[i] : null;
    const labelText: Rubric = montee
      ? {
          fr: `Parachat ${name} · ${montee.fr}`,
          en: `Parashat ${name} · ${montee.en}`,
          he: `פרשת ${hebrewName(parashaEntry)} · ${montee.he}`,
        }
      : {
          fr: `Parachat ${name} · 1re montée`,
          en: `Parashat ${name} · first aliyah`,
          he: `פרשת ${hebrewName(parashaEntry)} · עליית ראשון`,
        };
    const block: TextBlock = {
      label: labelText.fr,
      labelText,
      lines: [...lines],
      offset: 0, // recalculé ci-dessous
      paragraphs: lines.map((text) => ({ runs: [{ kind: "he", text }] })),
    };
    if (marker.when) block.when = marker.when;
    if (marker.plain) block.plain = true;
    torahBlocks.push(block);
  });
  if (torahBlocks.length === 0) return content;

  const blocks = [...section.blocks];
  blocks.splice(markerIndex, 1, ...torahBlocks);
  let offset = 0;
  const rebuilt = blocks.map((b) => {
    const copy: TextBlock = { ...b, offset };
    offset += b.lines.length;
    return copy;
  });
  const newSection = { ...section, blocks: rebuilt, he: rebuilt.flatMap((b) => b.lines) };
  return { ...content, sections: [newSection, ...content.sections.slice(1)] };
}

// ---- La plage horaire de l'office en cours --------------------------------

export interface TefilaWindow {
  tefila: TefilaKey;
  start: Date;
  end: Date;
}

/**
 * Bornes de chaque office, en clés d'horaires (voir computeZmanim) :
 * Cha'harit de misheyakir à 'hatsot, Min'ha de min'ha guedola à la chkia,
 * Arvit de la sortie des étoiles à 'hatsot de la nuit (les avis qui
 * l'étendent jusqu'à l'aube sont dans le « i » du lecteur, pas ici : le
 * raccourci de l'accueil annonce le temps propice, pas le rattrapage).
 */
const TEFILA_BOUNDS: [TefilaKey, ZmanKey, ZmanKey][] = [
  ["chaharit", "misheyakir", "chatzot"],
  ["minha", "minchaGedola", "sunset"],
  ["arvit", "tzeit", "chatzotNight"],
];

function windowsOfDay(place: ZmanimPlace, day: Date): TefilaWindow[] {
  const times = new Map(computeZmanim(place, day).map((z) => [z.key, z.date]));
  const windows: TefilaWindow[] = [];
  for (const [tefila, startKey, endKey] of TEFILA_BOUNDS) {
    const start = times.get(startKey);
    const end = times.get(endKey);
    if (start && end && start.getTime() < end.getTime()) windows.push({ tefila, start, end });
  }
  return windows;
}

/**
 * L'office dont c'est la plage horaire, ou null entre deux. Après minuit,
 * l'Arvit de la nuit en cours se lit sur les horaires de la veille (son
 * 'hatsot halayla appartient au jour civil précédent).
 */
export function currentTefilaWindow(
  place: ZmanimPlace,
  now: Date = new Date(),
): TefilaWindow | null {
  const t = now.getTime();
  const inWindow = (w: TefilaWindow) => t >= w.start.getTime() && t < w.end.getTime();
  const today = windowsOfDay(place, now).find(inWindow);
  if (today) return today;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    windowsOfDay(place, yesterday)
      .filter((w) => w.tefila === "arvit")
      .find(inWindow) ?? null
  );
}

/** Le chemin de lecture d'un office ("/bibliotheque/sidour/minha"). */
export function tefilaPath(tefila: TefilaKey): string | null {
  const entry = allTexts.find((e) => corpusOf(e) === "sidour" && slugOf(e) === tefila);
  return entry ? hubPath(entry) : null;
}
