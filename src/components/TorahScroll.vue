<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useReadingColumn } from "../composables/useReadingColumn";
import { useReadingSize } from "../composables/useReadingSize";
import { restoreScrollPointing, scrollPeek, scrollPointed } from "../composables/useScrollPointing";
import { pageZoomFrame } from "../services/pageZoom";
import { scrollPageStarts } from "../services/scrollPages";
import { pointedVerseWords } from "../services/scrollPointing";
import {
  azYashirLines,
  findTorahSongs,
  haazinouLine,
  scrollVerseWords,
  type ParashaMark,
} from "../services/pageForm";
import MarkedText from "./MarkedText.vue";

/**
 * Une paracha dans la forme du Sefer Torah : les lettres seules, dans
 * l'écriture du sofer, en une colonne justifiée. La petou'ha finit la ligne
 * (le verset suivant commence la ligne d'après), la setouma laisse un blanc
 * dans la ligne, et les deux chirot sont écrites à part : Az yachir en
 * briques, Haazinou en deux colonnes (pageForm.ts).
 *
 * Chaque verset reste un passage du lecteur (`data-line`) : la reprise de
 * lecture, le marque-page et la bulle de sélection marchent comme sur le
 * texte vocalisé. Le début de chaque montée porte un petit repère, comme la
 * marge d'un tikoun, qui est aussi l'ancre du menu de lecture.
 *
 * La colonne garde la même largeur en lettres sur tous les écrans, donc les
 * mêmes lignes : sur un téléphone ses caractères rétrécissent, elle ne se
 * replie pas. La taille de lecture (A− / A+, le pincement) l'agrandit tout
 * entière, comme la page du daf : elle déborde de la colonne de lecture tant
 * qu'il y a de la place, puis se fait glisser de côté (pageZoom.ts).
 *
 * Un blanc de trois lignes sépare les pages, toutes les quarante-deux lignes
 * (scrollPages.ts) ; rien n'y est écrit.
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
}>();

const emit = defineEmits<{
  (e: "pick", event: MouseEvent, line: number, text: string): void;
}>();

interface Verse {
  line: number;
  text: string;
  setouma: boolean;
}

type Piece =
  | { kind: "prose"; verses: Verse[] }
  | { kind: "haazinou"; rows: { line: number; halves: [string, string] }[] }
  | { kind: "az-yashir"; line: number; rows: string[][] };

/** Les paragraphes du parchemin, une petou'ha ou une chira les séparant. */
const pieces = computed<Piece[]>(() => {
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

/** La montée qui commence à ce verset, s'il y en a une. */
const aliyaAt = computed(() => new Map(props.aliyot.map((a) => [a.offset, a])));

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
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const word of (node.nodeValue ?? "").matchAll(/\S+/g)) {
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      const rect = range.getBoundingClientRect();
      found.push({
        left: (rect.left - origin.left) / font,
        top: (rect.top - origin.top) / font,
        width: rect.width / font,
        height: rect.height / font,
      });
    }
  }
  // Les pages : un blanc toutes les quarante-deux lignes (scrollPages.ts).
  const pages =
    found.length === wordRanks.value.total ? scrollPageStarts(found.map((box) => box.top)) : [];
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

/** La colonne du parchemin : une trentaine de lettres, soit 21 cadratins. */
const SCROLL_EMS = 21;
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
    SCROLL_EMS * SCROLL_REM * rem.value,
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
        width: `${SCROLL_EMS}em`,
        maxWidth: "none",
        fontSize: `${zoom.value.page / SCROLL_EMS}px`,
      }
    : undefined,
);

/** Les lignes commencent à droite : c'est là que la colonne se présente. */
function showLineStarts(): void {
  const el = frame.value;
  if (el) el.scrollLeft = el.scrollWidth;
}

onMounted(() => {
  rem.value = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  void nextTick(showLineStarts);
  // L'écriture du sofer arrive après le premier rendu : les mots bougent.
  void document.fonts?.ready.then(() => nextTick(measureWords));
});

onBeforeUnmount(() => window.clearTimeout(holdTimer));

// Les mots se relèvent quand une des deux formes peut servir, quand le texte
// change, et quand la colonne prend sa largeur en lettres (première mesure).
watch([wantsBoxes, () => props.lines, () => column.value > 0], () => void nextTick(measureWords), {
  flush: "post",
});

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
        <template v-for="(piece, p) in pieces" :key="p">
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
            }"
            ><span dir="rtl">{{ pointedWords[i] }}</span></span
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
