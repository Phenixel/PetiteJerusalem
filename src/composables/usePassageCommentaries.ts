import { computed, ref, shallowRef, watch, type Ref } from "vue";
import type { TextStudyJsonEntry } from "../models/models";
import {
  loadDafMeforshim,
  loadHalakhaMeforshim,
  loadMishnaMeforshim,
  loadTanakhRashi,
  type DafMeforshim,
  type RashiComment,
  type TextSection,
  type TranslationSource,
} from "../services/textService";
import { DAF_LAYOUT_REACH } from "../services/dafLayout";

/**
 * Les commentaires d'un passage du texte ouvert :
 * - une guemara : Rachi et Tossafot (le Rachbam en Bava Batra, là où il prend
 *   la place de Rachi) ;
 * - une michna : le Bartenura et les Tossefot Yom Tov ;
 * - un verset du Tanakh (paracha, Neviim, Ketouvim, un psaume) : Rachi ;
 * - un séif du Choulhan Aroukh : ses commentateurs, selon la partie (la
 *   Michna Broura et le Magen Avraham sur Ora'h Hayim, le Chakh sur Yoré
 *   Déa...). Le Kitsour n'en a pas.
 *
 * Ils servent au bouton « Commentaires » de la bulle d'un passage et au
 * panneau d'étude (CommentaryPanel.vue), et, bout à bout, à la page du daf
 * (TalmudDafPages.vue).
 *
 * Rien ne se charge à l'ouverture du texte : les fichiers viennent au premier
 * passage touché, ou à l'ouverture de la page du daf (`ensure`). Un chapitre
 * de guemara en demande une ou deux tranches, un traité de Michna ou un livre
 * son fichier, un siman du Choulhan Aroukh sa tranche de cinq simanim.
 *
 * When the translation is on, the page gives `pickLang`, which chooses a
 * language among those a commentary file is translated into: Rashi on the
 * Torah then carries its translation under each comment, and `sources` says
 * who made it. Turning the translation on or off, or changing its language,
 * reloads what was loaded.
 */

/** Les commentateurs, dans l'ordre où le panneau les présente. */
export type CommentarySource =
  | "rashi"
  | "rashbam"
  | "mefaresh"
  | "tosafot"
  | "ran"
  | "bartenura"
  | "tosafotYomTov"
  | HalakhaSource;

/**
 * Les commentateurs du Choulhan Aroukh, dans l'ordre où le panneau les
 * présente : ceux de la page imprimée d'abord, le Ba'er Hétev en dernier.
 * Chaque partie n'en a que quelques-uns (voir download-texts.mjs).
 */
export const HALAKHA_SOURCES = [
  "mishnaBerura",
  "magenAvraham",
  "chakh",
  "sma",
  "helkatMehokek",
  "beitChmouel",
  "taz",
  "ketsotHahochen",
  "chaareiTechouva",
  "pithheiTechouva",
  "baerHetev",
] as const;
export type HalakhaSource = (typeof HALAKHA_SOURCES)[number];

/** Un commentateur et ce qu'il dit du passage. */
export interface CommentaryGroup {
  source: CommentarySource;
  comments: RashiComment[];
}

/**
 * Le corpus dont le texte ouvert a des commentaires, ou null. `torah` (une
 * paracha) et `tanakh` (Neviim, Ketouvim, Tehilim) ont tous deux Rachi ; on
 * les distingue pour la mesure d'audience.
 */
export type CommentaryCorpus = "talmud" | "torah" | "mishna" | "tanakh" | "halakha" | null;

/** Le livre de halakha qui n'a pas de commentaires : le Kitsour. */
const isKitsour = (livre?: string) => Boolean(livre?.includes("Kitsour"));

/** Les livres du catalogue qui ont Rachi, hors Torah. */
const NACH_BOOKS = new Set(["Nevi'im (Prophets)", "Ketuvim (Writings)"]);

export function commentaryCorpusOf(
  type: string | undefined,
  section: TextSection | null,
  livre?: string,
): CommentaryCorpus {
  if (!section) return null;
  if (type === "Talmud Bavli" && section.dafBlocks?.length) return "talmud";
  // La forme du Sefer Torah et Rachi ont le même domaine : les parachiot.
  if (section.scrollMarks?.length) return "torah";
  if (type === "Mishna") return "mishna";
  if (type === "Halakha") return livre && !isKitsour(livre) ? "halakha" : null;
  if (type === "Tehilim" || (type === "Tanakh" && livre && NACH_BOOKS.has(livre))) return "tanakh";
  return null;
}

/**
 * Les cases d'une section dans une grille de commentaires : un texte lu d'un
 * seul tenant (une paracha, un livre, un psaume) a tous ses groupes bout à
 * bout ; un texte lu chapitre par chapitre (un traité de Michna, Chir
 * HaChirim) a le groupe de son chapitre.
 */
export function sectionCells(
  groups: RashiComment[][][],
  section: TextSection,
  whole: boolean,
): RashiComment[][] {
  return whole ? groups.flat() : (groups[section.index - 1] ?? []);
}

/**
 * Une ligne de la section (l'index de `he`) → l'amoud et le passage de
 * Sefaria qui portent ses commentaires.
 */
export function talmudPassageOf(
  section: TextSection,
  line: number,
): { amud: number; passage: number } | null {
  let offset = 0;
  for (const block of section.dafBlocks ?? []) {
    if (line < offset + block.lines.length) {
      if (block.amud === undefined) return null;
      return { amud: block.amud, passage: block.passages?.[line - offset] ?? line - offset };
    }
    offset += block.lines.length;
  }
  return null;
}

/** Les commentaires d'une ligne de guemara, dans l'ordre de la page. */
export function talmudGroups(
  meforshim: Map<number, DafMeforshim>,
  section: TextSection,
  line: number,
): CommentaryGroup[] {
  const place = talmudPassageOf(section, line);
  const amud = place ? meforshim.get(place.amud) : undefined;
  if (!place || !amud) return [];
  const inner = amud.rashi[place.passage] ?? [];
  // Rachi et le Rachbam sur la même page : chacun sous son nom.
  const cut = amud.rashbamAfter ? (amud.rashbamAfter[place.passage] ?? inner.length) : null;
  const groups: CommentaryGroup[] =
    cut === null
      ? [{ source: amud.inner, comments: inner }]
      : [
          { source: "rashi", comments: inner.slice(0, cut) },
          { source: "rashbam", comments: inner.slice(cut) },
        ];
  groups.push({ source: amud.outer ?? "tosafot", comments: amud.tosafot[place.passage] ?? [] });
  if (amud.margin) groups.push({ source: "tosafot", comments: amud.margin[place.passage] ?? [] });
  return groups.filter((g) => g.comments.length > 0);
}

/** Chooses the translation language among those a file has, or null (none shown). */
export type CommentaryLangPicker = (available: readonly string[]) => string | null;

export function usePassageCommentaries(
  textEntry: Ref<TextStudyJsonEntry | null>,
  section: Ref<TextSection | null>,
  pickLang: Ref<CommentaryLangPicker | null> = ref(null),
) {
  const corpus = computed<CommentaryCorpus>(() =>
    commentaryCorpusOf(
      textEntry.value ? String(textEntry.value.type) : undefined,
      section.value,
      textEntry.value?.livre,
    ),
  );
  const state = ref<"idle" | "loading" | "ready" | "error">("idle");
  /** Guemara : les commentaires par index d'amoud du traité. */
  const talmud = shallowRef<Map<number, DafMeforshim> | null>(null);
  /** Michna, Tanakh : chaque commentateur, ligne par ligne, aligné sur `he`. */
  const lines = shallowRef<{ source: CommentarySource; cells: RashiComment[][] }[] | null>(null);
  /** Who translated the commentaries shown, when they are translated. */
  const sources = shallowRef<TranslationSource[]>([]);

  let request = 0;
  function reset(): void {
    request++;
    state.value = "idle";
    talmud.value = null;
    lines.value = null;
    sources.value = [];
  }
  // Un autre texte, un autre chapitre : ce qui était chargé ne vaut plus.
  watch([textEntry, section], reset);
  // The translation turned on or off, or another language: what was loaded
  // comes back in the new one, without waiting for the next passage touched.
  watch(pickLang, () => {
    const loaded = state.value !== "idle";
    reset();
    if (loaded) void ensure();
  });

  /** Charge les commentaires de la section ouverte, une fois. */
  async function ensure(): Promise<void> {
    const entry = textEntry.value;
    const open = section.value;
    if (!entry || !open || !corpus.value) return;
    if (state.value === "loading" || state.value === "ready") return;
    const mine = ++request;
    state.value = "loading";
    try {
      if (corpus.value === "talmud") {
        // Une page du livre porte parfois un commentaire que nos textes
        // rangent plus tôt (jusqu'à six amoudim avant, là où est la michna) ou
        // à l'amoud suivant : on charge aussi les tranches de ces voisins.
        const amudim = (open.dafBlocks ?? [])
          .map((b) => b.amud)
          .filter((a): a is number => a !== undefined)
          .flatMap((a) => [Math.max(0, a - DAF_LAYOUT_REACH), a, a + 1]);
        const loaded = await loadDafMeforshim(entry, amudim);
        if (mine !== request) return;
        talmud.value = loaded;
      } else {
        const whole = entry.totalSections === 1;
        if (corpus.value === "halakha") {
          // Le numéro du siman dans le livre : une entrée d'un seul siman se
          // lit en section 1, son titre garde le vrai.
          const n = open.heading?.kind === "siman" ? open.heading.n : open.index;
          const loaded = await loadHalakhaMeforshim(entry, n);
          if (mine !== request) return;
          lines.value = HALAKHA_SOURCES.filter((source) => loaded[source]).map((source) => ({
            source,
            cells: loaded[source],
          }));
        } else if (corpus.value === "mishna") {
          const loaded = await loadMishnaMeforshim(entry);
          if (mine !== request) return;
          lines.value = [
            { source: "bartenura", cells: sectionCells(loaded.bartenura, open, whole) },
            { source: "tosafotYomTov", cells: sectionCells(loaded.tosafotYomTov, open, whole) },
          ];
        } else {
          const loaded = await loadTanakhRashi(entry, pickLang.value);
          if (mine !== request) return;
          lines.value = [{ source: "rashi", cells: sectionCells(loaded.groups, open, whole) }];
          sources.value = loaded.sources;
        }
      }
      state.value = "ready";
    } catch {
      if (mine === request) state.value = "error";
    }
  }

  /** Les commentaires d'une ligne de la section, une fois chargés. */
  function groupsAt(line: number): CommentaryGroup[] {
    const open = section.value;
    if (!open || state.value !== "ready") return [];
    if (corpus.value === "talmud" && talmud.value) return talmudGroups(talmud.value, open, line);
    return (lines.value ?? [])
      .map(({ source, cells }) => ({ source, comments: cells[line] ?? [] }))
      .filter((g) => g.comments.length > 0);
  }

  return { corpus, state, talmud, sources, ensure, groupsAt };
}

/** Le nom de chaque commentateur, en clés écrites en clair (i18nUsage.test.ts). */
export const COMMENTARY_LABELS = {
  rashi: "textReading.commentaries.rashi",
  rashbam: "textReading.commentaries.rashbam",
  mefaresh: "textReading.commentaries.mefaresh",
  tosafot: "textReading.commentaries.tosafot",
  ran: "textReading.commentaries.ran",
  bartenura: "textReading.commentaries.bartenura",
  tosafotYomTov: "textReading.commentaries.tosafotYomTov",
  mishnaBerura: "textReading.commentaries.mishnaBerura",
  magenAvraham: "textReading.commentaries.magenAvraham",
  chakh: "textReading.commentaries.chakh",
  sma: "textReading.commentaries.sma",
  helkatMehokek: "textReading.commentaries.helkatMehokek",
  beitChmouel: "textReading.commentaries.beitChmouel",
  taz: "textReading.commentaries.taz",
  ketsotHahochen: "textReading.commentaries.ketsotHahochen",
  chaareiTechouva: "textReading.commentaries.chaareiTechouva",
  pithheiTechouva: "textReading.commentaries.pithheiTechouva",
  baerHetev: "textReading.commentaries.baerHetev",
} as const satisfies Record<CommentarySource, string>;
