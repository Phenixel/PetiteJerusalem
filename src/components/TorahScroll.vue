<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useReadingColumn } from "../composables/useReadingColumn";
import { useReadingSize } from "../composables/useReadingSize";
import { restoreScrollPointing, scrollPeek, scrollPointed } from "../composables/useScrollPointing";
import { pageZoomFrame } from "../services/pageZoom";
import {
  HALF_STRETCH_MAX,
  SCROLL_COLUMN_EMS,
  columnScale,
  estimatedWidth,
  fitLine,
  loadScrollLayout,
  scrollColumns,
  type LineFit,
  type ScrollLayout,
  type ScrollPiece,
  type ScrollRun,
} from "../services/scrollLayout";
import { scrollPageStarts } from "../services/scrollPages";
import { pointedVerseWords } from "../services/scrollPointing";
import {
  azYashirLines,
  findTorahSongs,
  haazinouLine,
  leadRanges,
  scrollVerseWords,
  type ParashaMark,
} from "../services/pageForm";
import MarkedText from "./MarkedText.vue";

/**
 * Une paracha dans la forme du Sefer Torah : les lettres seules, dans
 * l'écriture du sofer, ligne pour ligne et colonne pour colonne comme le
 * rouleau de 245 colonnes (scrollLayout.ts, public/texts/torah-layout). La
 * petou'ha finit la ligne, la setouma laisse un blanc dans la ligne, Az
 * yachir s'écrit en briques et Haazinou en deux moitiés, là où le rouleau
 * les met. Chaque ligne remplit la colonne comme le sofer la remplit : ses
 * lettres s'élargissent ou se resserrent un peu, ses mots ne s'écartent pas.
 *
 * Sans le fichier des lignes (pas de réseau), la colonne s'écrit à notre
 * façon : justifiée, les marques et les chirot reconnues dans le texte
 * (pageForm.ts), un blanc toutes les quarante-deux lignes (scrollPages.ts).
 *
 * Chaque verset reste un passage du lecteur (`data-line`) : on le touche pour
 * ouvrir ses commentaires, comme sur le texte vocalisé. Le début de chaque
 * montée porte un repère dans la marge, comme celle d'un tikoun, qui est
 * aussi l'ancre du menu de lecture.
 *
 * La colonne garde la même largeur en lettres sur tous les écrans, donc les
 * mêmes lignes : sur un téléphone ses caractères rétrécissent, elle ne se
 * replie pas. La taille de lecture (A− / A+, le pincement) l'agrandit tout
 * entière, comme la page du daf : elle déborde de la colonne de lecture tant
 * qu'il y a de la place, puis se fait glisser de côté (pageZoom.ts).
 */
const props = defineProps<{
  /** Les versets de la paracha, à plat (la section du lecteur). */
  lines: string[];
  /** La marque qui suit chaque verset, alignée sur `lines`. */
  marks: ParashaMark[];
  /** Les montées : leur premier verset, leur ancre et leur titre. */
  aliyot: { offset: number; anchor: string; label: string }[];
  pickedLine?: number | null;
  highlightedLine?: number | null;
  /** Le passage étudié et les dibbourim de ses commentaires (voir MarkedText). */
  leads?: { line: number; leads: string[] } | null;
  /** Le texte ouvert : son fichier de lignes porte ce numéro (torah-layout). */
  textId?: number | string | null;
}>();

const emit = defineEmits<{
  (e: "pick", event: MouseEvent, line: number, text: string): void;
}>();

// ---- Les lignes du rouleau --------------------------------------------------

/** Les lignes du rouleau pour ce texte ; `undefined` tant qu'on les attend. */
const layout = shallowRef<ScrollLayout | null | undefined>(undefined);
watch(
  () => props.textId,
  async (id) => {
    if (id === null || id === undefined) {
      layout.value = null;
      return;
    }
    layout.value = undefined;
    const loaded = await loadScrollLayout(id);
    if (props.textId === id) layout.value = loaded;
  },
  { immediate: true },
);

const verseWords = computed(() => props.lines.map(scrollVerseWords));
const columns = computed(() =>
  layout.value ? scrollColumns(layout.value, verseWords.value) : null,
);
/** On attend le fichier : rien ne s'écrit encore, pour ne pas écrire deux fois. */
const waiting = computed(() => layout.value === undefined);

/** La montée qui commence à ce verset, s'il y en a une. */
const aliyaAt = computed(() => new Map(props.aliyot.map((a) => [a.offset, a])));

/** La marge où se posent les repères de montée, en cadratins de la page. */
const MARGIN_EMS = 1.25;
/** Le blanc du milieu d'une ligne de Haazinou. */
const HALF_GAP_EMS = 2.25;
/** Le moins qu'un blanc laisse entre deux morceaux d'une ligne. */
const BLANK_EMS = 2.2;
/** Une grande lettre, une petite : leur taille dans la ligne. */
const LETTER_SIZES = { big: 1.4, small: 0.7 } as const;
type LetterSize = keyof typeof LETTER_SIZES;

/** La police dans laquelle la colonne s'écrit vraiment (voir onMounted). */
const family = ref("");
/** Avance quand une police arrive : les largeurs se mesurent à nouveau. */
const fontEpoch = ref(0);
let canvas: CanvasRenderingContext2D | null = null;
const measured = new Map<string, number>();

/** La largeur d'un texte dans l'écriture de la colonne, en cadratins. */
function widthOf(text: string): number {
  if (!canvas || !family.value) return estimatedWidth(text);
  let width = measured.get(text);
  if (width === undefined) {
    width = canvas.measureText(text).width / 100;
    measured.set(text, width);
  }
  return width;
}

/** Les grandes et les petites lettres, par mot (`verset:mot`). */
const specialLetters = computed(() => {
  const found = new Map<string, Map<number, LetterSize>>();
  const add = (list: [number, number, number][] | undefined, size: LetterSize): void => {
    for (const [verse, word, letter] of list ?? []) {
      const key = `${verse}:${word}`;
      if (!found.has(key)) found.set(key, new Map());
      found.get(key)!.set(letter, size);
    }
  };
  add(layout.value?.big, "big");
  add(layout.value?.small, "small");
  return found;
});

/** Les mots du passage étudié que citent ses commentaires, par leur rang. */
const leadWords = computed(() => {
  const lead = props.leads;
  const words = lead ? verseWords.value[lead.line] : undefined;
  if (!lead?.leads.length || !words) return null;
  const ranges = leadRanges(words.join(" "), lead.leads);
  const marked = new Set<number>();
  let at = 0;
  words.forEach((word, k) => {
    const end = at + word.length;
    if (ranges.some(([a, b]) => a < end && b > at)) marked.add(k);
    at = end + 1;
  });
  return marked.size ? { line: lead.line, marked } : null;
});

/** Un bout de texte d'un verset : tel quel, souligné, ou un mot à lettre à part. */
interface Segment {
  text: string;
  marked: boolean;
  /** Un mot dont une lettre est grande ou petite, lettre par lettre. */
  letters?: { text: string; size?: LetterSize }[];
}

function segmentsOf(run: ScrollRun, last: boolean): Segment[] {
  const lead = leadWords.value?.line === run.verse ? leadWords.value.marked : null;
  const out: Segment[] = [];
  const push = (text: string, marked: boolean): void => {
    const previous = out[out.length - 1];
    if (previous && !previous.letters && previous.marked === marked) previous.text += text;
    else out.push({ text, marked });
  };
  run.words.forEach((word, k) => {
    const rank = run.from + k;
    const marked = lead?.has(rank) ?? false;
    // L'espace est soulignée entre deux mots soulignés, pas à leur bord.
    if (k > 0) push(" ", marked && (lead?.has(rank - 1) ?? false));
    const special = specialLetters.value.get(`${run.verse}:${rank}`);
    if (special) {
      const letters = [...word].map((text, i) => ({ text, size: special.get(i) }));
      out.push({ text: word, marked, letters });
    } else {
      push(word, marked);
    }
  });
  if (!last) push(" ", false);
  return out;
}

/** Ce qu'une ligne écrit d'un trait, posé sur sa largeur. */
interface Box {
  /** L'étirement de ses lettres (voir fitLine). */
  stretch: number;
  style: Record<string, string>;
  pieces: { runs: { verse: number; opens: boolean; segments: Segment[] }[] }[];
}
interface SheetRow {
  kind: "blank" | "full" | "pieces" | "halves";
  /** Les cases de la ligne (deux pour Haazinou), leur largeur et leur contenu. */
  cells: { width?: string; box: Box }[];
  justify?: string;
  aliya?: { anchor: string; label: string };
}
interface SheetColumn {
  column: number;
  scale: number;
  rows: SheetRow[];
}

function boxStyle(fit: LineFit): Record<string, string> {
  const style: Record<string, string> = {};
  if (Math.abs(fit.stretch - 1) > 0.002) {
    style.width = `${(100 / fit.stretch).toFixed(3)}%`;
    style.transform = `scaleX(${fit.stretch.toFixed(4)})`;
  }
  if (fit.spacing) style.wordSpacing = `${fit.spacing.toFixed(4)}em`;
  return style;
}

/**
 * La colonne telle qu'elle s'écrit : chaque ligne du rouleau, et de combien
 * ses lettres s'étirent pour la remplir. Une colonne plus large que les
 * autres (Az yachir) s'écrit plus petit, pour tenir dans la même page.
 */
const sheet = computed<SheetColumn[] | null>(() => {
  const all = columns.value;
  if (!all) return null;
  // Les largeurs dépendent de la police : on recompte quand elle arrive.
  void fontEpoch.value;
  const space = widthOf(" ") || 0.25;
  const natural = (piece: ScrollPiece): number => {
    let total = 0;
    let words = 0;
    for (const run of piece.runs) {
      run.words.forEach((word, k) => {
        total += widthOf(word);
        const special = specialLetters.value.get(`${run.verse}:${run.from + k}`);
        special?.forEach((size, i) => {
          total += (LETTER_SIZES[size] - 1) * widthOf(word[i] ?? "");
        });
        words++;
      });
    }
    return total + (words - 1) * space;
  };
  const gapsOf = (piece: ScrollPiece): number => piece.count - 1;
  const content = (piece: ScrollPiece) => ({
    runs: piece.runs.map((run, i) => ({
      verse: run.verse,
      opens: run.from === 0 && aliyaAt.value.has(run.verse),
      segments: segmentsOf(run, i === piece.runs.length - 1),
    })),
  });
  return all.map((column) => {
    const widths = column.rows.map((row) => row.pieces.map(natural));
    const scale = columnScale(
      column.rows.flatMap((row, r) => (row.kind === "full" ? [widths[r][0]] : [])),
    );
    const target = SCROLL_COLUMN_EMS / scale;
    const rows = column.rows.map((row, r): SheetRow => {
      const opening = row.pieces
        .flatMap((piece) => piece.runs)
        .find((run) => run.from === 0 && aliyaAt.value.has(run.verse));
      const aliya = opening ? aliyaAt.value.get(opening.verse) : undefined;
      if (row.kind === "blank") return { kind: "blank", cells: [] };
      if (row.kind === "full") {
        const fit = fitLine(widths[r][0], gapsOf(row.pieces[0]), space, target);
        return {
          kind: "full",
          cells: [
            {
              box: {
                stretch: fit.stretch,
                style: boxStyle(fit),
                pieces: [content(row.pieces[0])],
              },
            },
          ],
          aliya,
        };
      }
      if (row.kind === "halves") {
        const half = (target - HALF_GAP_EMS) / 2;
        return {
          kind: "halves",
          cells: row.pieces.map((piece, p) => {
            const fit = fitLine(widths[r][p], gapsOf(piece), space, half, HALF_STRETCH_MAX);
            return {
              width: `${half.toFixed(3)}em`,
              box: { stretch: fit.stretch, style: boxStyle(fit), pieces: [content(piece)] },
            };
          }),
          aliya,
        };
      }
      // Des morceaux et des blancs : les morceaux gardent leur écriture, les
      // blancs prennent la place qui reste ; faute de place, tout se resserre.
      const blanks = row.pieces.length - 1 + (row.lead ? 1 : 0) + (row.trail ? 1 : 0);
      const needed = widths[r].reduce((a, b) => a + b, 0) + blanks * BLANK_EMS;
      const fit = { stretch: Math.min(1, target / needed), spacing: 0 };
      return {
        kind: "pieces",
        cells: [
          { box: { stretch: fit.stretch, style: boxStyle(fit), pieces: row.pieces.map(content) } },
        ],
        justify: row.lead && !row.trail ? "flex-end" : row.trail ? "flex-start" : "space-between",
        aliya,
      };
    });
    return { column: column.column, scale, rows };
  });
});

interface Verse {
  line: number;
  text: string;
  setouma: boolean;
}

type Piece =
  | { kind: "prose"; verses: Verse[] }
  | { kind: "haazinou"; rows: { line: number; halves: [string, string] }[] }
  | { kind: "az-yashir"; line: number; rows: string[][] };

/**
 * Sans les lignes du rouleau : les paragraphes du parchemin, une petou'ha ou
 * une chira les séparant.
 */
const pieces = computed<Piece[]>(() => {
  if (waiting.value || columns.value) return [];
  const songs = findTorahSongs(props.lines);
  const out: Piece[] = [];
  let prose: Verse[] = [];
  const close = (): void => {
    if (prose.length) out.push({ kind: "prose", verses: prose });
    prose = [];
  };
  for (let i = 0; i < props.lines.length; i++) {
    const song = songs.find((s) => s.start === i);
    if (song) {
      close();
      const verses = props.lines.slice(song.start, song.end + 1);
      if (song.kind === "haazinou") {
        out.push({
          kind: "haazinou",
          rows: verses.map((v, k) => ({ line: song.start + k, halves: haazinouLine(v) })),
        });
      } else {
        out.push({ kind: "az-yashir", line: song.start, rows: azYashirLines(verses) });
      }
      i = song.end;
      continue;
    }
    const text = scrollVerseWords(props.lines[i]).join(" ");
    if (!text) continue;
    prose.push({ line: i, text, setouma: props.marks[i] === "setouma" });
    if (props.marks[i] === "petoukha") close();
  }
  close();
  return out;
});

/** Az yachir n'a qu'un passage : la montée qui commence dans la chira s'y rattache. */
function aliyaWithin(start: number, count: number) {
  return props.aliyot.find((a) => a.offset >= start && a.offset < start + count);
}

// ---- Les pages du parchemin -------------------------------------------------

const countWords = (text: string): number => (text ? text.split(" ").length : 0);

/**
 * Le rang, parmi tous les mots de la colonne, du premier mot de chaque verset
 * et de chaque ligne de chira, dans l'ordre où ils sont écrits.
 */
const wordRanks = computed(() => {
  const verses = new Map<number, number>();
  const bricks = new Map<string, number>();
  let rank = 0;
  pieces.value.forEach((piece, p) => {
    if (piece.kind === "prose") {
      for (const verse of piece.verses) {
        verses.set(verse.line, rank);
        rank += countWords(verse.text);
      }
    } else if (piece.kind === "haazinou") {
      for (const row of piece.rows) {
        verses.set(row.line, rank);
        rank += countWords(row.halves[0]) + countWords(row.halves[1]);
      }
    } else {
      piece.rows.forEach((row, r) => {
        bricks.set(`${p}:${r}`, rank);
        rank += row.reduce((n, member) => n + countWords(member), 0);
      });
    }
  });
  return { verses, bricks, total: rank };
});

/** Le rang du premier mot de chaque page après la première (measureWords). */
const pageStarts = ref<number[]>([]);

/**
 * Un verset de prose coupé là où une page commence : un blanc avant lui si
 * elle commence par lui, et ses morceaux, un blanc entre deux.
 */
const proseParts = computed(() => {
  const parts = new Map<number, { gapBefore: boolean; texts: string[] }>();
  for (const piece of pieces.value) {
    if (piece.kind !== "prose") continue;
    for (const verse of piece.verses) {
      const start = wordRanks.value.verses.get(verse.line) ?? 0;
      const words = verse.text.split(" ");
      const texts: string[] = [];
      let at = 0;
      for (const page of pageStarts.value) {
        if (page <= start || page >= start + words.length) continue;
        texts.push(words.slice(at, page - start).join(" "));
        at = page - start;
      }
      texts.push(words.slice(at).join(" "));
      parts.set(verse.line, { gapBefore: pageStarts.value.includes(start), texts });
    }
  }
  return parts;
});

/**
 * Une page commence-t-elle à cette ligne de chira ? Une ligne ne se coupe
 * pas : la page qui commencerait au milieu de la précédente commence ici.
 */
function pageAt(rank: number | undefined, previous: number | undefined): boolean {
  if (rank === undefined) return false;
  const after = previous ?? rank - 1;
  return pageStarts.value.some((page) => page > after && page <= rank);
}

function stateClass(line: number) {
  return {
    "bg-primary/10": props.highlightedLine === line,
    "reading-selected": props.pickedLine === line && props.highlightedLine !== line,
  };
}

function pick(event: MouseEvent, line: number): void {
  // Un appui long qui vient de montrer l'autre forme ne choisit pas un passage.
  if (peeking.value || performance.now() < swallowUntil) return;
  emit("pick", event, line, props.lines[line] ?? "");
}

// ---- Les voyelles et les teamim, sur les mêmes lignes ----------------------

restoreScrollPointing();
const scrollEl = ref<HTMLElement | null>(null);
/** Vrai tant qu'un appui long montre l'autre forme (scrollPeek). */
const peeking = ref(false);
/** Ce qu'on montre : le réglage, ou son contraire le temps d'un appui. */
const showPointed = computed(() => scrollPointed.value !== peeking.value);
/** Faut-il savoir où sont les mots ? Dès qu'une des deux formes peut servir. */
const wantsBoxes = computed(() => scrollPointed.value || scrollPeek.value);
const pointedWords = computed(() =>
  wantsBoxes.value ? props.lines.flatMap(pointedVerseWords) : [],
);

/** La place d'un mot du parchemin dans la colonne, en cadratins. */
interface WordBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** La taille de l'écriture à cet endroit (une colonne large s'écrit plus petit). */
  size: number;
  /** Le resserrement de sa ligne, que le mot lu suit. */
  squeeze: number;
}
const boxes = ref<WordBox[]>([]);

/**
 * Relève la place de chaque mot écrit. La colonne a partout la même largeur
 * en lettres : ces places, comptées en cadratins, valent à toutes les
 * tailles. Le mot lu se pose ensuite sur le mot écrit, au même endroit : les
 * lignes ne peuvent pas bouger, chirot comprises.
 */
function measureWords(): void {
  const el = scrollEl.value;
  if (!el) return;
  const font = parseFloat(getComputedStyle(el).fontSize);
  const origin = el.getBoundingClientRect();
  if (!font || !origin.width) return;
  const found: WordBox[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(".scroll-aliya, .scroll-pointed")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const range = document.createRange();
  // L'écriture d'une ligne : sa taille et son resserrement, lus une fois.
  const scripts = new Map<Element, { size: number; squeeze: number }>();
  const scriptOf = (parent: Element): { size: number; squeeze: number } => {
    const box = parent.closest(".scroll-box") ?? el;
    let script = scripts.get(box);
    if (!script) {
      const stretch = Number((box as HTMLElement).dataset.stretch) || 1;
      script = {
        size: parseFloat(getComputedStyle(box).fontSize) / font || 1,
        squeeze: Math.min(1, stretch),
      };
      scripts.set(box, script);
    }
    return script;
  };
  const add = (rect: DOMRect, parent: Element): void => {
    found.push({
      left: (rect.left - origin.left) / font,
      top: (rect.top - origin.top) / font,
      width: rect.width / font,
      height: rect.height / font,
      ...scriptOf(parent),
    });
  };
  let whole: Element | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent) continue;
    // Un mot à grande ou petite lettre tient en plusieurs bouts : on le
    // relève d'un seul tenant.
    const word = parent.closest(".scroll-word");
    if (word) {
      if (word !== whole) {
        range.selectNodeContents(word);
        add(range.getBoundingClientRect(), word);
        whole = word;
      }
      continue;
    }
    for (const match of (node.nodeValue ?? "").matchAll(/\S+/g)) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      add(range.getBoundingClientRect(), parent);
    }
  }
  // Sans les lignes du rouleau, les pages : un blanc toutes les quarante-deux
  // lignes (scrollPages.ts).
  const pages =
    !sheet.value && found.length === wordRanks.value.total
      ? scrollPageStarts(found.map((box) => box.top))
      : [];
  // Un blanc posé déplace les mots qui le suivent : on les relève à nouveau.
  // Il tombe au début d'une ligne, les lignes ne changent donc pas, et la
  // seconde passe retrouve les mêmes pages.
  if (pages.join() !== pageStarts.value.join() && passes < 3) {
    passes++;
    pageStarts.value = pages;
    void nextTick(measureWords);
    return;
  }
  passes = 0;
  // Un mot de trop ou de moins, et l'on ne saurait plus lequel poser où :
  // la colonne reste alors telle que le sofer l'écrit.
  boxes.value = wantsBoxes.value && found.length === pointedWords.value.length ? found : [];
}

let passes = 0;

const pointedShown = computed(() => showPointed.value && boxes.value.length > 0);

// ---- L'appui long ----------------------------------------------------------

/** Le temps d'appui qui fait un appui long, et le jeu laissé au doigt. */
const HOLD_MS = 350;
const HOLD_SLACK = 10;
let holdTimer = 0;
let holdStart = { x: 0, y: 0 };
let swallowUntil = 0;

function onPointerDown(event: PointerEvent): void {
  if (!scrollPeek.value || (event.pointerType === "mouse" && event.button !== 0)) return;
  holdStart = { x: event.clientX, y: event.clientY };
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(() => {
    peeking.value = true;
  }, HOLD_MS);
}

/** Un doigt qui glisse fait défiler la page : ce n'est pas un appui. */
function onPointerMove(event: PointerEvent): void {
  if (peeking.value || !holdTimer) return;
  if (Math.hypot(event.clientX - holdStart.x, event.clientY - holdStart.y) > HOLD_SLACK) {
    window.clearTimeout(holdTimer);
    holdTimer = 0;
  }
}

function onPointerEnd(): void {
  window.clearTimeout(holdTimer);
  holdTimer = 0;
  if (!peeking.value) return;
  peeking.value = false;
  // Le clic qui suit le relâchement n'est pas un choix de passage.
  swallowUntil = performance.now() + 500;
}

/** Avec l'appui long, le menu du système ne s'ouvre pas sur le texte. */
function onContextMenu(event: Event): void {
  if (!scrollPeek.value) return;
  event.preventDefault();
  event.stopPropagation();
}

/** Sans les lignes du rouleau : une trentaine de lettres, soit 21 cadratins. */
const FLOW_EMS = 21;
/**
 * La largeur de la page en cadratins : la colonne du rouleau et sa marge, ou
 * notre colonne à défaut.
 */
const scrollEms = computed(() =>
  sheet.value || waiting.value ? SCROLL_COLUMN_EMS + MARGIN_EMS : FLOW_EMS,
);
/** La taille ordinaire de son écriture, en rem (voir le style). */
const SCROLL_REM = 1.5;

const readingSize = useReadingSize();
const { ruler, column, free } = useReadingColumn();
const frame = ref<HTMLElement | null>(null);
const rem = ref(16);

const zoom = computed(() =>
  pageZoomFrame(
    readingSize.scale.value,
    column.value,
    free.value.left,
    free.value.right,
    scrollEms.value * SCROLL_REM * rem.value,
  ),
);
/** Le cadre déborde de la colonne de lecture d'autant de chaque côté. */
const frameStyle = computed(() => ({ marginInline: `${-zoom.value.grow}px` }));
/**
 * La colonne à sa largeur en lettres, l'écriture à la taille qui la fait
 * tenir dans la page agrandie. Avant la première mesure, le style seul.
 */
const scrollStyle = computed(() =>
  column.value
    ? {
        width: `${scrollEms.value}em`,
        maxWidth: "none",
        fontSize: `${zoom.value.page / scrollEms.value}px`,
      }
    : undefined,
);

/** Les lignes commencent à droite : c'est là que la colonne se présente. */
function showLineStarts(): void {
  const el = frame.value;
  if (el) el.scrollLeft = el.scrollWidth;
}

/** Mesure dans la police qui s'affiche, maintenant qu'on la connaît. */
function readFont(): void {
  const el = scrollEl.value;
  if (!el) return;
  family.value = getComputedStyle(el).fontFamily;
  canvas ??= document.createElement("canvas").getContext("2d");
  if (canvas) canvas.font = `100px ${family.value}`;
  measured.clear();
  fontEpoch.value++;
}

/** Une police vient d'arriver : les mots n'ont plus la même largeur. */
function onFontsLoaded(): void {
  readFont();
  void nextTick(measureWords);
}

onMounted(() => {
  rem.value = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  readFont();
  void nextTick(showLineStarts);
  // L'écriture du sofer ne se charge qu'une fois demandée, après le premier
  // rendu : on la demande, et les lignes se posent à nouveau quand elle est là.
  const fonts = document.fonts;
  if (!fonts) return;
  fonts.addEventListener?.("loadingdone", onFontsLoaded);
  void fonts
    .load(`1em ${family.value}`, "אבג")
    .then(onFontsLoaded)
    .catch(() => undefined);
});

onBeforeUnmount(() => {
  window.clearTimeout(holdTimer);
  document.fonts?.removeEventListener?.("loadingdone", onFontsLoaded);
});

// Les mots se relèvent quand une des deux formes peut servir, quand le texte
// change, quand la colonne prend sa largeur en lettres (première mesure), et
// quand les lignes du rouleau arrivent ou manquent.
watch(
  [wantsBoxes, () => props.lines, () => column.value > 0, sheet, waiting],
  () => void nextTick(measureWords),
  { flush: "post" },
);

// Quand la loupe change, le milieu de ce qu'on regardait reste au milieu.
watch(
  () => zoom.value.page,
  async () => {
    const el = frame.value;
    if (!el) return;
    const hidden = el.scrollWidth - el.clientWidth;
    const centre = hidden > 0 ? (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth : 1;
    await nextTick();
    el.scrollLeft = hidden > 0 ? centre * el.scrollWidth - el.clientWidth / 2 : el.scrollWidth;
  },
);
</script>

<template>
  <div class="scroll-zoom-root">
    <div ref="ruler" class="scroll-ruler" aria-hidden="true"></div>
    <!-- Le cadre de la loupe, écrit de gauche à droite pour que `scrollLeft`
         se lise de la même façon partout ; la colonne, dedans, garde son sens. -->
    <div ref="frame" class="scroll-zoom" dir="ltr" :style="frameStyle">
      <div
        ref="scrollEl"
        class="torah-scroll"
        :class="{ 'scroll-pointed-on': pointedShown, 'scroll-peek-on': scrollPeek }"
        dir="rtl"
        :style="scrollStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerEnd"
        @pointercancel="onPointerEnd"
        @pointerleave="onPointerEnd"
        @contextmenu.capture="onContextMenu"
      >
        <!-- Les lignes du rouleau : colonne par colonne, ligne pour ligne. -->
        <div v-if="sheet" class="scroll-columns" :style="{ '--scroll-margin': `${MARGIN_EMS}em` }">
          <template v-for="(page, c) in sheet" :key="page.column">
            <div v-if="c > 0" class="scroll-column-gap" aria-hidden="true"></div>
            <div
              class="scroll-column"
              :data-column="page.column"
              :style="{ '--scroll-scale': String(page.scale) }"
            >
              <div
                v-for="(row, r) in page.rows"
                :key="r"
                class="scroll-line"
                :class="`scroll-line-${row.kind}`"
              >
                <span
                  v-if="row.aliya"
                  class="scroll-aliya scroll-aliya-margin"
                  :data-block-anchor="row.aliya.anchor"
                  dir="auto"
                  >{{ row.aliya.label }}</span
                >
                <div
                  v-for="(cell, k) in row.cells"
                  :key="k"
                  class="scroll-cell"
                  :style="cell.width ? { width: cell.width } : undefined"
                >
                  <div
                    class="scroll-box"
                    :class="{ 'scroll-box-pieces': row.kind === 'pieces' }"
                    :data-stretch="cell.box.stretch"
                    :style="[cell.box.style, row.justify ? { justifyContent: row.justify } : {}]"
                  >
                    <span v-for="(part, i) in cell.box.pieces" :key="i" class="scroll-piece"
                      ><span
                        v-for="(run, j) in part.runs"
                        :key="j"
                        :data-line="run.verse"
                        class="reading-pick scroll-verse"
                        :class="[stateClass(run.verse), { 'scroll-opens': run.opens }]"
                        @click="pick($event, run.verse)"
                        @contextmenu="pick($event, run.verse)"
                        ><template v-for="(segment, n) in run.segments" :key="n"
                          ><span
                            v-if="segment.letters"
                            class="scroll-word"
                            :class="{ 'scroll-lead': segment.marked }"
                            ><template v-for="(letter, l) in segment.letters" :key="l"
                              ><span v-if="letter.size" :class="`scroll-letter-${letter.size}`">{{
                                letter.text
                              }}</span
                              ><template v-else>{{ letter.text }}</template></template
                            ></span
                          ><span v-else-if="segment.marked" class="scroll-lead">{{
                            segment.text
                          }}</span
                          ><template v-else>{{ segment.text }}</template></template
                        ></span
                      ></span
                    >
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Sans elles : la colonne à notre façon. -->
        <template v-for="(piece, p) in pieces" v-else :key="p">
          <p v-if="piece.kind === 'prose'" class="scroll-para">
            <template v-for="verse in piece.verses" :key="verse.line">
              <span
                v-if="proseParts.get(verse.line)?.gapBefore"
                class="scroll-page-gap"
                aria-hidden="true"
              ></span>
              <span
                v-if="aliyaAt.get(verse.line)"
                class="scroll-aliya"
                :data-block-anchor="aliyaAt.get(verse.line)!.anchor"
                dir="auto"
                >{{ aliyaAt.get(verse.line)!.label }}</span
              >
              <span
                :data-line="verse.line"
                class="reading-pick scroll-verse"
                :class="stateClass(verse.line)"
                @click="pick($event, verse.line)"
                @contextmenu="pick($event, verse.line)"
                ><template
                  v-for="(text, k) in proseParts.get(verse.line)?.texts ?? [verse.text]"
                  :key="k"
                  ><span v-if="k > 0" class="scroll-page-gap" aria-hidden="true"></span
                  ><MarkedText
                    :text="text"
                    :leads="leads?.line === verse.line ? leads.leads : null"
                  />{{
                    k < (proseParts.get(verse.line)?.texts.length ?? 1) - 1 ? " " : ""
                  }}</template
                ></span
              >
              <span v-if="verse.setouma" class="scroll-setouma" aria-hidden="true"></span>
              {{ " " }}
            </template>
          </p>

          <!-- Haazinou : un verset par ligne, ses deux moitiés de part et d'autre
           d'un blanc. -->
          <div v-else-if="piece.kind === 'haazinou'" class="scroll-song">
            <template v-for="(row, r) in piece.rows" :key="row.line">
              <div
                v-if="
                  pageAt(
                    wordRanks.verses.get(row.line),
                    r > 0 ? wordRanks.verses.get(piece.rows[r - 1].line) : undefined,
                  )
                "
                class="scroll-page-gap-row"
                aria-hidden="true"
              ></div>
              <span
                v-if="aliyaAt.get(row.line)"
                class="scroll-aliya scroll-aliya-row"
                :data-block-anchor="aliyaAt.get(row.line)!.anchor"
                dir="auto"
                >{{ aliyaAt.get(row.line)!.label }}</span
              >
              <div
                :data-line="row.line"
                class="reading-pick scroll-row scroll-row-2"
                :class="stateClass(row.line)"
                @click="pick($event, row.line)"
                @contextmenu="pick($event, row.line)"
              >
                <span>{{ row.halves[0] }}</span>
                <span>{{ row.halves[1] }}</span>
              </div>
            </template>
          </div>

          <!-- Az yachir : « une demi-brique sur une brique ». -->
          <div
            v-else
            :data-line="piece.line"
            class="reading-pick scroll-song scroll-bricks"
            :class="stateClass(piece.line)"
            @click="pick($event, piece.line)"
            @contextmenu="pick($event, piece.line)"
          >
            <span
              v-if="aliyaWithin(piece.line, piece.rows.length)"
              class="scroll-aliya scroll-aliya-row"
              :data-block-anchor="aliyaWithin(piece.line, piece.rows.length)!.anchor"
              dir="auto"
              >{{ aliyaWithin(piece.line, piece.rows.length)!.label }}</span
            >
            <template v-for="(row, r) in piece.rows" :key="r">
              <div
                v-if="
                  pageAt(
                    wordRanks.bricks.get(`${p}:${r}`),
                    r > 0 ? wordRanks.bricks.get(`${p}:${r - 1}`) : undefined,
                  )
                "
                class="scroll-page-gap-row"
                aria-hidden="true"
              ></div>
              <div class="scroll-row" :class="row.length === 1 ? 'scroll-row-full' : ''">
                <span v-for="(member, m) in row" :key="m">{{ member }}</span>
              </div>
            </template>
          </div>
        </template>
        <!-- Les mots lus, posés chacun sur le mot écrit : mêmes lignes. -->
        <div v-if="pointedShown" class="scroll-pointed" dir="ltr" aria-hidden="true">
          <span
            v-for="(box, i) in boxes"
            :key="i"
            class="scroll-pointed-word"
            :style="{
              left: `${box.left}em`,
              top: `${box.top}em`,
              width: `${box.width}em`,
              height: `${box.height}em`,
              fontSize: box.size === 1 ? undefined : `${box.size}em`,
            }"
            ><span
              dir="rtl"
              :style="box.squeeze < 1 ? { transform: `scaleX(${box.squeeze})` } : undefined"
              >{{ pointedWords[i] }}</span
            ></span
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Les voyelles et les teamim : le mot lu se pose sur le mot écrit, qui garde
   sa place et s'efface. Il est dans la police de lecture, que le lecteur
   choisit : l'écriture du sofer n'a pas ces signes. */
.scroll-pointed {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: var(--font-hebrew);
}

.scroll-pointed-word {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.scroll-pointed-word > span {
  font-size: 0.78em;
  line-height: 1;
}

.scroll-pointed-on .scroll-verse,
.scroll-pointed-on .scroll-row {
  color: transparent;
}

.scroll-pointed-on .scroll-lead {
  text-decoration-color: var(--color-primary);
}

/* Avec l'appui long, le texte ne se sélectionne pas sous le doigt. */
.scroll-peek-on {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* Les pages : un blanc de trois lignes toutes les quarante-deux lignes, sans
   rien d'écrit. Dans la prose c'est un flottant de toute la largeur, posé
   devant le premier mot de la page : il ne tient pas sur la ligne qui
   précède et passe dessous, sans la couper ni lui ôter sa justification. */
.scroll-page-gap {
  float: right;
  width: 100%;
  height: 5.25em;
}

.scroll-page-gap-row {
  height: 5.25em;
}

/* ---- Les lignes du rouleau ----

   La colonne garde, à droite, une marge où se posent les repères de montée :
   comme dans un tikoun, ils ne prennent pas de place dans la ligne. */
.scroll-columns {
  padding-right: var(--scroll-margin);
}

/* Une colonne du rouleau. Plus large que les autres (Az yachir), elle
   s'écrit plus petit, pour tenir dans la même page. */
.scroll-column {
  font-size: calc(1em * var(--scroll-scale, 1));
}

/* D'une colonne à l'autre : un blanc de trois lignes, rien d'écrit. */
.scroll-column-gap {
  height: 5.25em;
}

/* Une ligne : toujours une ligne de haut, écrite ou blanche, et jamais
   repliée. */
.scroll-line {
  position: relative;
  display: flex;
  justify-content: space-between;
  height: 1.75em;
  white-space: nowrap;
}

.scroll-cell {
  flex: none;
  width: 100%;
}

/* Ce que la ligne écrit d'un trait. Ses lettres s'étirent ou se resserrent
   en largeur pour remplir la colonne (voir fitLine) : la case garde le bord
   droit, là où la ligne commence. */
.scroll-box {
  transform-origin: 100% 50%;
}

/* Des morceaux et des blancs : les morceaux aux bords, les blancs entre eux. */
.scroll-box-pieces {
  display: flex;
  justify-content: space-between;
  gap: 2.2em;
}

.scroll-piece {
  flex: none;
}

/* Les mots que citent les commentaires du passage étudié (voir MarkedText). */
.scroll-lead {
  text-decoration: underline;
  text-decoration-color: var(--color-primary);
  text-decoration-thickness: 2px;
  text-underline-offset: 0.3em;
  text-decoration-skip-ink: none;
}

/* Les grandes et les petites lettres du rouleau. */
.scroll-letter-big {
  font-size: 1.4em;
  line-height: 0;
}

.scroll-letter-small {
  font-size: 0.7em;
}

/* Le premier mot d'une montée : un trait fin au-dessus de lui, pour savoir où
   elle commence dans la ligne. */
.scroll-opens {
  background-image: linear-gradient(var(--color-primary), var(--color-primary));
  background-repeat: no-repeat;
  background-position: 100% 0.18em;
  background-size: 0.55em 2px;
}

/* Le repère de montée, dans la marge, écrit de haut en bas. Sa taille ne suit
   pas l'échelle de la colonne ; sa place se compte dans ses propres
   cadratins (0,4 de ceux de la page) : au milieu de la marge. */
.scroll-aliya.scroll-aliya-margin {
  position: absolute;
  top: 0.4em;
  right: -2.56em;
  display: block;
  margin: 0;
  padding: 0.5em 0;
  writing-mode: vertical-rl;
  font-size: calc(0.4em / var(--scroll-scale, 1));
  line-height: 2;
  white-space: nowrap;
}

/* Le repère de la colonne de lecture : sa largeur, sans hauteur. */
.scroll-ruler {
  height: 0;
}

/* Le cadre de la loupe : une colonne plus large que la place qu'elle a se
   fait glisser de côté. */
.scroll-zoom {
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}

/* La colonne du parchemin : l'écriture du sofer (Stam Sefarad CLM, voir
   main.css), à la taille de lecture, justifiée, une trentaine de lettres par
   ligne comme une colonne de Sefer Torah. */
.torah-scroll {
  position: relative;
  container-type: inline-size;
  max-width: 21em;
  margin-inline: auto;
  font-family: "Stam Sefarad CLM", var(--font-hebrew);
  font-size: calc(1.5rem * var(--reading-scale, 1));
  line-height: 1.75;
  color: var(--color-text-primary);
}

/* Une petou'ha finit le paragraphe : la dernière ligne reste à droite, le
   reste de la ligne est vide. */
.scroll-para {
  text-align: justify;
  text-align-last: start;
  margin-bottom: 0;
}

.scroll-para + .scroll-para,
.scroll-song,
.scroll-para + .scroll-song,
.scroll-song + .scroll-para {
  margin-top: 0;
}

.scroll-verse {
  border-radius: var(--radius-sm);
  transition: background-color 0.5s;
}

/* La setouma : un blanc de neuf lettres dans la ligne. */
.scroll-setouma {
  display: inline-block;
  width: 4.5em;
}

/* Le repère de montée, dans la police de l'interface, comme une note de
   marge : il ne fait pas partie du texte écrit. */
.scroll-aliya {
  display: inline-block;
  margin-inline-end: 0.4em;
  padding: 0 0.4em;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 0.45em;
  font-weight: 600;
  line-height: 1.6;
  vertical-align: middle;
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.scroll-aliya-row {
  display: table;
  margin: 0.25em 0;
}

/* Une ligne de chira tient sur la largeur de la colonne, comme sur le
   parchemin : sur un écran étroit, la chira se resserre plutôt que de
   replier un membre sur deux lignes. */
.scroll-song {
  border-radius: var(--radius-sm);
  transition: background-color 0.5s;
}

.scroll-bricks {
  font-size: min(1em, 4.2cqi);
}

/* Une ligne de chira : ses membres aux deux bords (et au milieu pour trois),
   les blancs entre eux. */
.scroll-row {
  display: flex;
  justify-content: space-between;
  gap: 1em;
  border-radius: var(--radius-sm);
}

.scroll-bricks .scroll-row {
  white-space: nowrap;
}

/* Haazinou : chaque moitié colle à son bord, le blanc au milieu ; un long
   verset passe à la ligne dans sa moitié. */
.scroll-row-2 {
  gap: 2em;
}

.scroll-row-2 > span {
  flex: 1 1 0;
  text-align: justify;
  text-align-last: start;
}

.scroll-row-2 > span + span {
  text-align-last: end;
}

.scroll-row-full {
  display: block;
  white-space: normal;
  text-align: justify;
  text-align-last: start;
}
</style>
