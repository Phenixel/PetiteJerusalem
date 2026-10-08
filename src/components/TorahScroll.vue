<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useReadingColumn } from "../composables/useReadingColumn";
import { useReadingSize } from "../composables/useReadingSize";
import { pageZoomFrame } from "../services/pageZoom";
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

function stateClass(line: number) {
  return {
    "bg-primary/10": props.highlightedLine === line,
    "reading-selected": props.pickedLine === line && props.highlightedLine !== line,
  };
}

function pick(event: MouseEvent, line: number): void {
  emit("pick", event, line, props.lines[line] ?? "");
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
      <div class="torah-scroll" dir="rtl" :style="scrollStyle">
        <template v-for="(piece, p) in pieces" :key="p">
          <p v-if="piece.kind === 'prose'" class="scroll-para">
            <template v-for="verse in piece.verses" :key="verse.line">
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
                ><MarkedText
                  :text="verse.text"
                  :leads="leads?.line === verse.line ? leads.leads : null"
              /></span>
              <span v-if="verse.setouma" class="scroll-setouma" aria-hidden="true"></span>
              {{ " " }}
            </template>
          </p>

          <!-- Haazinou : un verset par ligne, ses deux moitiés de part et d'autre
           d'un blanc. -->
          <div v-else-if="piece.kind === 'haazinou'" class="scroll-song">
            <template v-for="row in piece.rows" :key="row.line">
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
            <div
              v-for="(row, r) in piece.rows"
              :key="r"
              class="scroll-row"
              :class="row.length === 1 ? 'scroll-row-full' : ''"
            >
              <span v-for="(member, m) in row" :key="m">{{ member }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
