<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue";
import {
  DAF_UNITS,
  dafLines,
  type DafLayoutPage,
  type DafLine,
  type DafWord,
} from "../services/dafLayout";
import { commentLinked, linkLeads, linkedMeforshim, type DafLink } from "../services/dafLinks";
import { amudOf, leadRanges } from "../services/pageForm";
import type { DafMeforshim } from "../services/textService";

/**
 * Un amoud ligne pour ligne comme la page de Vilna (dafLayout.ts,
 * public/texts/talmud-layout) : chaque ligne de la guemara, de Rachi et de
 * Tossafot est posée là où le livre l'imprime, avec les mots qu'il y met.
 *
 * Rien ne coule : une ligne a sa boîte, et son texte la remplit d'un bord à
 * l'autre. Nos polices n'ont pas les largeurs de celles du livre ; la taille
 * de chaque zone est donc celle qui fait tenir sa ligne médiane sans la
 * déformer. Une ligne plus courte que sa boîte est justifiée par le
 * navigateur lui-même (ses espaces s'ouvrent) ; une ligne plus longue se
 * resserre. Sa largeur vraie est lue sur l'écran, une fois écrite : une
 * estimation, si juste soit-elle, laisse des bords en dents de scie.
 * Tout se compte en parts de la largeur de la page : la page agrandie
 * (la loupe de TalmudDafPages) garde ses lignes.
 *
 * Un passage et ses commentaires se répondent, comme sur la page composée à
 * notre façon (TalmudPage.vue, dafLinks.ts).
 */
const props = defineProps<{
  /** « 2a ». */
  daf: string;
  /** L'index de l'amoud dans le traité. */
  amud: number;
  page: DafLayoutPage;
  /** La guemara de l'amoud, et le passage de Sefaria de chaque ligne. */
  lines: string[];
  passages?: number[];
  /** Les commentaires du chapitre, par amoud ; null tant qu'ils arrivent. */
  meforshim: Map<number, DafMeforshim> | null;
  linked?: DafLink | null;
}>();

const emit = defineEmits<{
  (e: "link", touched: DafLink | null): void;
  /** Le fichier de lignes ne colle pas au texte : la page se compose autrement. */
  (e: "mismatch"): void;
}>();

const root = ref<HTMLElement | null>(null);

const printed = computed<DafLine[] | null>(() =>
  dafLines(props.page, props.amud, props.lines, props.passages, props.meforshim),
);
watchEffect(() => {
  if (!printed.value) emit("mismatch");
});

// ---- La largeur des mots, dans les polices de la page ----------------------

type Face = "main" | "side" | "lead";
/** La taille du dibbour hamat'hil dans sa ligne de commentaire. */
const LEAD_SIZE = 0.94;
/** Les polices des trois écritures de la page, lues sur l'écran. */
const faces = ref<Record<Face, string> | null>(null);
const fontEpoch = ref(0);
let canvas: CanvasRenderingContext2D | null = null;
const measured = new Map<string, number>();

function widthOf(text: string, face: Face): number {
  if (!canvas || !faces.value) return text.length * (face === "side" ? 0.45 : 0.52);
  const key = `${face}:${text}`;
  let width = measured.get(key);
  if (width === undefined) {
    canvas.font = faces.value[face];
    // Le dibbour est écrit un peu plus petit que la ligne (voir le style).
    width = (canvas.measureText(text).width / 100) * (face === "lead" ? LEAD_SIZE : 1);
    measured.set(key, width);
  }
  return width;
}

function readFonts(): void {
  const el = root.value;
  if (!el) return;
  const family = (selector: string): string => {
    const probe = el.querySelector(selector);
    const style = probe ? getComputedStyle(probe) : null;
    return style ? `${style.fontWeight} 100px ${style.fontFamily}` : "100px serif";
  };
  faces.value = {
    main: family(".daf-probe-main"),
    side: family(".daf-probe-side"),
    lead: family(".daf-probe-lead"),
  };
  canvas ??= document.createElement("canvas").getContext("2d");
  measured.clear();
  fontEpoch.value++;
}

const onFonts = (): void => readFonts();

onMounted(() => {
  readFonts();
  const fonts = document.fonts;
  if (!fonts) return;
  fonts.addEventListener?.("loadingdone", onFonts);
  // L'écriture de Rachi ne se charge qu'une fois demandée.
  void Promise.all([
    fonts.load(faces.value?.side ?? "100px serif", "אבג"),
    fonts.load(faces.value?.main ?? "100px serif", "אבג"),
    fonts.load(faces.value?.lead ?? "100px serif", "אבג"),
  ])
    .then(onFonts)
    .catch(() => undefined);
});

onBeforeUnmount(() => document.fonts?.removeEventListener?.("loadingdone", onFonts));

// ---- La largeur vraie des lignes, lue sur l'écran ---------------------------

/**
 * La largeur de chaque ligne telle que l'écran l'écrit, en cadratins de sa
 * zone ; null tant qu'on ne l'a pas lue (la première image se fie au canvas).
 */
const seen = ref<{ of: DafLine[]; widths: number[] } | null>(null);
/** La taille à laquelle chaque ligne est écrite en ce moment (voir rows). */
let written: number[] = [];
let observer: ResizeObserver | null = null;

function measure(): void {
  const el = root.value;
  const lines = printed.value;
  if (!el || !lines || !lines.length) return;
  const texts = el.querySelectorAll<HTMLElement>(".daf-row-text");
  if (texts.length !== lines.length || written.length !== lines.length) return;
  // Le temps de la lecture, chaque ligne prend sa largeur naturelle.
  el.classList.add("daf-measuring");
  const widths: number[] = [];
  let ok = true;
  texts.forEach((text, i) => {
    const box = text.parentElement!.getBoundingClientRect().width;
    const own = text.getBoundingClientRect().width;
    if (!(box > 0) || !(own > 0)) ok = false;
    // En cadratins : la part de la boîte que le texte occupe, à sa taille.
    else widths.push(((own / box) * lines[i].width) / written[i]);
  });
  el.classList.remove("daf-measuring");
  if (ok && widths.length === lines.length) seen.value = { of: lines, widths };
}

watch([printed, fontEpoch], () => void nextTick(measure), { flush: "post" });

onMounted(() => {
  void nextTick(measure);
  // Une page écrite hors de l'écran (sans largeur) se lit quand elle y vient.
  if (typeof ResizeObserver !== "undefined" && root.value) {
    observer = new ResizeObserver(() => {
      if (seen.value?.of !== printed.value) measure();
    });
    observer.observe(root.value);
  }
});

onBeforeUnmount(() => observer?.disconnect());

// ---- Poser chaque ligne dans sa boîte ---------------------------------------

/**
 * Jusqu'où les lettres d'une ligne trop courte s'élargissent avant que ses
 * espaces prennent le reste. Une ligne trop longue se resserre sans limite :
 * elle ne sort jamais de sa boîte.
 */
const WIDEN = 1.08;
/** La hauteur d'une lettre carrée, en part de son corps. */
const LETTER = 0.66;

const faceOf = (line: DafLine, word: DafWord): Face =>
  line.zone === "main" ? "main" : word.lead ? "lead" : "side";

/** La largeur d'une ligne telle que nos polices l'écrivent, en cadratins. */
function natural(line: DafLine): number {
  const space = widthOf(" ", line.zone === "main" ? "main" : "side");
  return (
    line.words.reduce((total, word) => total + widthOf(word.text, faceOf(line, word)), 0) +
    Math.max(0, line.words.length - 1) * space
  );
}

/** Un bout de ligne d'un seul tenant : même passage, même commentaire. */
interface Run {
  passage: number;
  comment: number | undefined;
  parts: { text: string; lead: boolean; marked: boolean; big: boolean }[];
}
interface Row {
  zone: DafLine["zone"];
  kind: DafLine["kind"];
  style: Record<string, string>;
  inner: Record<string, string>;
  runs: Run[];
}

/** Les mots du passage choisi que citent ses commentaires surlignés. */
const markedWords = computed(() => {
  const link = props.linked;
  const m = props.meforshim?.get(props.amud);
  if (!link || !m) return null;
  const leads = linkLeads(link, linkedMeforshim(m));
  if (!leads.length) return null;
  const words = (printed.value ?? [])
    .filter((line) => line.zone === "main")
    .flatMap((line) => line.words.filter((word) => word.passage === link.passage));
  const ranges = leadRanges(words.map((w) => w.text).join(" "), leads);
  const marked = new Set<DafWord>();
  let at = 0;
  for (const word of words) {
    const end = at + word.text.length;
    if (ranges.some(([a, b]) => a < end && b > at)) marked.add(word);
    at = end + 1;
  }
  return marked;
});

const rows = computed<Row[]>(() => {
  const lines = printed.value;
  if (!lines) return [];
  void fontEpoch.value;
  const widths = seen.value?.of === lines ? seen.value.widths : lines.map(natural);
  // La taille de chaque zone : celle qui fait tenir sa ligne médiane telle
  // quelle. Elle ne dépasse pas l'interligne du livre.
  const sizes = new Map<DafLine["zone"], number>();
  for (const zone of ["main", "rashi", "tosafot"] as const) {
    const fits = lines
      .map((line, i) =>
        line.zone === zone && !line.kind && line.words.length >= 4 ? line.width / widths[i] : 0,
      )
      .filter((fit) => fit > 0 && Number.isFinite(fit))
      .sort((a, b) => a - b);
    const pitch = props.page.pitch[zone === "main" ? 0 : 1];
    const fit = fits.length ? fits[fits.length >> 1] : pitch * 0.8;
    sizes.set(zone, pitch ? Math.min(fit, pitch * 0.98) : fit);
  }
  // Rachi et Tossafot sont composés dans le même corps.
  const side = Math.min(sizes.get("rashi")!, sizes.get("tosafot")!);
  sizes.set("rashi", side);
  sizes.set("tosafot", side);
  const marked = markedWords.value;
  // Le mot d'ouverture et la ligne de clôture ont leur taille : celle des
  // lettres du livre (une lettre carrée tient les deux tiers de son corps).
  const sizeOf = (line: DafLine): number =>
    line.kind && line.height ? line.height / LETTER : sizes.get(line.zone)!;
  written = lines.map(sizeOf);
  return lines.map((line, i): Row => {
    const size = written[i];
    const width = widths[i] * size;
    // Trop longue, la ligne se resserre jusqu'à sa boîte. Trop courte, ses
    // lettres s'élargissent à peine et la justification fait le reste. Le mot
    // d'ouverture, seul dans sa boîte, s'y ajuste tout entier.
    const widen = line.kind === "initial" ? 1.6 : WIDEN;
    const stretch = width ? Math.min(widen, line.width / width) : 1;
    const runs: Run[] = [];
    line.words.forEach((word, k) => {
      let run = runs[runs.length - 1];
      if (!run || run.passage !== word.passage || run.comment !== word.comment) {
        run = { passage: word.passage, comment: word.comment, parts: [] };
        runs.push(run);
      }
      const text = word.text + (k < line.words.length - 1 ? " " : "");
      const isMarked = marked?.has(word) ?? false;
      const last = run.parts[run.parts.length - 1];
      const isBig = word.big ?? false;
      if (last && last.lead === word.lead && last.marked === isMarked && last.big === isBig)
        last.text += text;
      else run.parts.push({ text, lead: word.lead, marked: isMarked, big: isBig });
    });
    return {
      zone: line.zone,
      kind: line.kind,
      style: {
        left: `${(line.x / DAF_UNITS) * 100}%`,
        top: `${(line.y / props.page.height) * 100}%`,
        width: `${(line.width / DAF_UNITS) * 100}%`,
        fontSize: `${(size / DAF_UNITS) * 100}cqw`,
      },
      inner: {
        width: `${(100 / stretch).toFixed(3)}%`,
        transform: `scaleX(${stretch.toFixed(4)})`,
      },
      runs,
    };
  });
});

// ---- Un passage et ses commentaires se répondent ---------------------------

/** Les passages qu'un commentaire de la page explique. */
const commented = computed(() => {
  const passages = new Set<number>();
  for (const line of printed.value ?? []) {
    if (line.zone === "main") continue;
    for (const word of line.words) if (word.passage >= 0) passages.add(word.passage);
  }
  return passages;
});

function touch(row: Row, run: Run): void {
  if (row.zone === "main") {
    emit("link", commented.value.has(run.passage) ? { passage: run.passage } : null);
  } else if (run.passage >= 0 && run.comment !== undefined) {
    emit("link", { passage: run.passage, comment: { zone: row.zone, index: run.comment } });
  }
}

function isLinked(row: Row, run: Run): boolean {
  const link = props.linked ?? null;
  if (!link || run.passage < 0) return false;
  if (row.zone === "main") return link.passage === run.passage;
  return (
    run.comment !== undefined &&
    commentLinked(link, row.zone, run.comment, { passage: run.passage })
  );
}

function isLinkable(row: Row, run: Run): boolean {
  return row.zone === "main" ? commented.value.has(run.passage) : run.passage >= 0;
}
</script>

<template>
  <div
    ref="root"
    class="daf-page daf-printed"
    dir="rtl"
    :data-amud="amudOf(daf)"
    :style="{ aspectRatio: `${DAF_UNITS} / ${page.height}` }"
  >
    <!-- De quoi lire les polices de la page, sans rien montrer. -->
    <span class="daf-probe" aria-hidden="true"
      ><span class="daf-probe-main"></span><span class="daf-probe-side"></span
      ><span class="daf-probe-lead"></span
    ></span>
    <div
      v-for="(row, i) in rows"
      :key="i"
      class="daf-row"
      :class="[
        row.zone === 'main' ? 'daf-row-main' : 'daf-row-side',
        row.kind ? `daf-row-${row.kind}` : '',
      ]"
      :style="row.style"
    >
      <div class="daf-row-text" :style="row.inner">
        <span
          v-for="(run, k) in row.runs"
          :key="k"
          class="daf-run"
          :class="{ 'daf-linkable': isLinkable(row, run), 'daf-linked': isLinked(row, run) }"
          :data-passage="run.passage >= 0 ? run.passage : undefined"
          @click="touch(row, run)"
          ><template v-for="(part, p) in run.parts" :key="p"
            ><b v-if="part.lead" class="daf-lead">{{ part.text }}</b
            ><b v-else-if="part.big" class="daf-big" :class="{ 'daf-cited': part.marked }">{{
              part.text
            }}</b
            ><span v-else-if="part.marked" class="daf-cited">{{ part.text }}</span
            ><template v-else>{{ part.text }}</template></template
          ></span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
/* La page : ses proportions sont celles du livre, et tout s'y compte en parts
   de sa largeur. */
.daf-printed {
  position: relative;
  container-type: inline-size;
  width: 100%;
  color: var(--color-text-primary);
}

.daf-probe {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
}

/* Une ligne : sa boîte sur la page, repérée par le milieu de sa hauteur. */
.daf-row {
  position: absolute;
  transform: translateY(-50%);
  line-height: 1.25;
  white-space: nowrap;
  pointer-events: none;
}

/* Son texte remplit la boîte d'un bord à l'autre : justifié s'il est plus
   court qu'elle, resserré en largeur s'il est plus long. Il garde le bord
   droit, là où la ligne commence. */
.daf-row-text {
  transform-origin: 100% 50%;
  text-align: justify;
  text-align-last: justify;
}

/* Le temps de lire sa largeur naturelle (voir measure). */
.daf-measuring .daf-row-text {
  display: inline-block;
  width: auto !important;
  transform: none !important;
  text-align-last: auto;
}

/* La guemara en lettres carrées, dans la police hébraïque du lecteur. */
.daf-row-main,
.daf-probe-main {
  font-family: var(--font-hebrew);
}

/* Les commentaires en écriture de Rachi, le dibbour hamat'hil en carré gras. */
.daf-row-side,
.daf-probe-side {
  font-family: "Noto Rashi Hebrew", var(--font-hebrew);
}

.daf-lead,
.daf-probe-lead {
  font-family: var(--font-hebrew);
  font-weight: 700;
}

.daf-row-side .daf-lead {
  font-size: 0.94em;
}

/* Le mot d'ouverture d'un traité ou d'un chapitre, en très grand dans le
   blanc au-dessus de la guemara ; la ligne qui clôt un chapitre. */
.daf-row-initial,
.daf-row-closing {
  font-weight: 700;
  line-height: 1;
}

.daf-row-closing .daf-row-text {
  text-align: center;
  text-align-last: center;
}

/* « גמ׳ », « מתני׳ », le premier mot d'un chapitre commencé en milieu de page. */
.daf-big {
  font-weight: 700;
}

.daf-run {
  pointer-events: auto;
  border-radius: var(--radius-sm);
  transition: background-color 0.2s;
}

.daf-linkable {
  cursor: pointer;
}

@media (hover: hover) {
  .daf-linkable:hover {
    background-color: color-mix(in srgb, var(--color-primary) 9%, transparent);
  }
}

.daf-linked,
.daf-linkable.daf-linked:hover {
  background-color: var(--color-selection);
}

/* Les mots que citent les commentaires surlignés (voir MarkedText). */
.daf-cited {
  text-decoration: underline;
  text-decoration-color: var(--color-primary);
  text-decoration-thickness: 2px;
  text-underline-offset: 0.3em;
  text-decoration-skip-ink: none;
}
</style>
