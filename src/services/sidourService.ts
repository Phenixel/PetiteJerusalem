import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { corpusOf, slugOf, latinName, hubPath } from "../content/etudeTexts";
import type { WeeklyParasha } from "./dailyCycles";
import type { Rubric, TextBlock, TextContent, TextParagraph } from "./textService";
import { computeZmanim, type ZmanKey, type ZmanimPlace } from "./zmanimService";

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
  return (
    allTexts.find((e) => corpusOf(e) === "sidour" && slugOf(e) === next) ?? null
  );
}

// ---- Lecture de la Torah de la semaine (lundi et jeudi) -------------------

/** Le nom hébreu d'une entrée : « ברכות (Berakhot) » → « ברכות ». */
const hebrewName = (entry: TextStudyJsonEntry): string =>
  entry.name.replace(/\s*\([^)]*\)\s*$/, "").trim();

/**
 * Remplit le marqueur `torahWeekly` de Cha'harit avec la 1re montée de la
 * paracha de la semaine : c'est elle qu'on lit le lundi et le jeudi matin,
 * répartie entre les trois montées (Cohen, Lévi, Israël).
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
  const firstAliyah = parashaSection?.blocks?.[0] ?? null;
  const lines = firstAliyah?.lines ?? parashaSection?.he.slice(0, 20) ?? [];
  if (!parashaEntry || lines.length === 0) return content;

  const name = latinName(parashaEntry);
  const labelText: Rubric = {
    fr: `Parachat ${name} · 1re montée`,
    en: `Parashat ${name} · first aliyah`,
    he: `פרשת ${hebrewName(parashaEntry)} · עליית ראשון`,
  };
  const marker = section.blocks[markerIndex];
  const paragraphs: TextParagraph[] = lines.map((text) => ({
    runs: [{ kind: "he", text }],
  }));
  const torahBlock: TextBlock = {
    label: labelText.fr,
    labelText,
    lines: [...lines],
    offset: 0, // recalculé ci-dessous
    paragraphs,
  };
  if (marker.when) torahBlock.when = marker.when;
  if (marker.plain) torahBlock.plain = true;

  const blocks = [...section.blocks];
  blocks[markerIndex] = torahBlock;
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
export function currentTefilaWindow(place: ZmanimPlace, now: Date = new Date()): TefilaWindow | null {
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
