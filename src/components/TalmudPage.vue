<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { RashiComment } from "../services/textService";
import {
  commentLinked,
  commentedPassages,
  linkLeads,
  type DafLink,
  type DafZone,
} from "../services/dafLinks";
import { amudOf, dafColumns, dafSides, gemaraPageText, talmudOpenings } from "../services/pageForm";
import MarkedText from "./MarkedText.vue";

/**
 * Un amoud dans la forme de la page de Vilna : la guemara au centre, Rachi
 * du côté de la reliure, Tossafot du côté du bord. Les deux commentaires
 * prennent chacun une moitié du haut de la page (quatre lignes), puis une
 * colonne le long de la guemara ; celui qui est plus long qu'elle passe
 * dessous et reprend sa moitié (toute la largeur une fois l'autre fini),
 * celui qui est plus court s'arrête et laisse la guemara s'élargir de son
 * côté.
 *
 * Le web ne sait pas faire couler trois textes l'un autour de l'autre : on
 * superpose trois calques de la largeur de la page, chacun avec ses blancs
 * flottants (les « spacers » de daf-renderer, MIT, Dan Jutan et Shaun
 * Regenbaum), et l'on règle la hauteur de ces blancs à partir de ce que
 * l'écran mesure : où finit chaque commentaire, puis où finit la guemara
 * (dafColumns). La mesure se refait quand la largeur, la taille de lecture
 * ou les polices changent.
 *
 * Un passage et ses commentaires se répondent (dafLinks.ts) : on touche un
 * passage que Rachi ou Tossafot explique, il se surligne avec eux ; on touche
 * un commentaire, il se surligne avec son passage. Le surlignage ne change
 * aucune largeur : la page ne se recompose pas.
 */
type PageComment = RashiComment & { passage?: number };

const props = defineProps<{
  /** « 2a » : dit le côté de la reliure. */
  daf: string;
  /** La guemara de l'amoud, telle que le fichier la porte (vocalisée). */
  lines: string[];
  /**
   * Rachi et Tossafot de l'amoud, bout à bout ; null : la guemara seule.
   * `passage` : le passage que le commentaire explique (linkedMeforshim).
   */
  meforshim: { rashi: PageComment[]; tosafot: PageComment[] } | null;
  /** Le passage de Sefaria dont vient chaque ligne (DafBlock.passages). */
  passages?: number[];
  /** Ce qu'on a touché sur cette page, s'il y a lieu (dafLinks.ts). */
  linked?: DafLink | null;
  /** La taille de lecture (useReadingSize). */
  scale: number;
  /** Le premier amoud du traité : son premier mot ouvre la Michna, en gras. */
  tractateStart?: boolean;
}>();

const emit = defineEmits<{
  /** On a touché un passage ou un commentaire ; `null` : un passage sans commentaire. */
  (e: "link", touched: DafLink | null): void;
}>();

const sides = computed(() => dafSides(amudOf(props.daf)));
/**
 * La guemara, passage par passage, sans voyelles : le début de chaque Michna
 * et de chaque Guemara en gras, comme sur la page imprimée (talmudOpenings).
 */
const mainLines = computed(() =>
  props.lines
    .map((line, k) => {
      const text = gemaraPageText([line]);
      return {
        text,
        strong: talmudOpenings(text, props.tractateStart && k === 0),
        passage: props.passages?.[k] ?? k,
      };
    })
    .filter((l) => l.text),
);
const rashi = computed(() => props.meforshim?.rashi ?? []);
const tosafot = computed(() => props.meforshim?.tosafot ?? []);

// ---- Un passage et ses commentaires se répondent ---------------------------

/** Les commentaires qui disent quel passage ils expliquent. */
const linkable = computed(() => ({
  rashi: rashi.value.flatMap((c) =>
    c.passage === undefined ? [] : [{ ...c, passage: c.passage }],
  ),
  tosafot: tosafot.value.flatMap((c) =>
    c.passage === undefined ? [] : [{ ...c, passage: c.passage }],
  ),
}));
/** Les passages qu'on peut toucher : ceux qu'un commentaire explique. */
const commented = computed(() => commentedPassages(linkable.value));
/** Les mots du passage choisi que citent ses commentaires surlignés. */
const linkedLeads = computed(() => {
  const leads = linkLeads(props.linked ?? null, linkable.value);
  return leads.length ? leads : null;
});

function touchPassage(passage: number): void {
  emit("link", commented.value.has(passage) ? { passage } : null);
}

function touchComment(zone: DafZone, index: number, comment: PageComment): void {
  if (comment.passage === undefined) return;
  emit("link", { passage: comment.passage, comment: { zone, index } });
}

function isLinked(zone: DafZone, index: number, comment: PageComment): boolean {
  return commentLinked(props.linked ?? null, zone, index, comment);
}

const root = ref<HTMLElement | null>(null);
const mainHead = ref<HTMLElement | null>(null);
const mainRashi = ref<HTMLElement | null>(null);
const mainTosafot = ref<HTMLElement | null>(null);
const mainEnd = ref<HTMLElement | null>(null);
const rashiHead = ref<HTMLElement | null>(null);
const rashiColumn = ref<HTMLElement | null>(null);
const rashiBelow = ref<HTMLElement | null>(null);
const rashiEnd = ref<HTMLElement | null>(null);
const tosafotHead = ref<HTMLElement | null>(null);
const tosafotColumn = ref<HTMLElement | null>(null);
const tosafotBelow = ref<HTMLElement | null>(null);
const tosafotEnd = ref<HTMLElement | null>(null);

/** Plus haut que n'importe quelle page : « jusqu'en bas ». */
const ENDLESS = 100000;
/** La part de la largeur que prend la guemara, comme à Vilna. */
const MAIN_SHARE = 0.5;

const height = ref(0);

/** Le bas d'un repère de fin de texte, depuis le haut de la page. */
function bottomOf(marker: HTMLElement | null, top: number): number {
  return marker ? marker.getBoundingClientRect().bottom - top : 0;
}

function px(el: HTMLElement | null, prop: "height" | "width", value: number | string): void {
  if (el) el.style[prop] = typeof value === "number" ? `${value}px` : value;
}

/**
 * Compose la page. Quatre passes de mesure : les commentaires dans leurs
 * colonnes sans fin, la guemara entre eux, la reprise sous la guemara de
 * celui qui la dépasse, puis la pleine largeur pour celui qui finit seul.
 */
function layout(): void {
  const el = root.value;
  if (!el) return;
  const width = el.clientWidth;
  if (!width) return;

  // La taille suit la largeur de la page (ses proportions restent celles du
  // livre) sans descendre sous un plancher lisible, puis la taille de lecture.
  const mainSize = Math.max(13, width * 0.026) * props.scale;
  const sideSize = mainSize * 0.72;
  const mainLine = Math.round(mainSize * 1.4);
  const sideLine = Math.round(sideSize * 1.38);
  const gapX = Math.max(8, width * 0.02);
  const gapY = Math.round(sideLine * 0.6);
  el.style.setProperty("--daf-main-size", `${mainSize}px`);
  el.style.setProperty("--daf-main-line", `${mainLine}px`);
  el.style.setProperty("--daf-side-size", `${sideSize}px`);
  el.style.setProperty("--daf-side-line", `${sideLine}px`);

  const hasRashi = rashi.value.length > 0;
  const hasTosafot = tosafot.value.length > 0;
  const sideWidth = (width * (1 - MAIN_SHARE)) / 2;
  // L'en-tête : quatre lignes de commentaire au-dessus de la guemara. Un seul
  // commentaire y prend toute la largeur ; aucun, et la guemara commence en haut.
  const head = hasRashi || hasTosafot ? 4 * sideLine : 0;
  const half = hasRashi && hasTosafot ? width / 2 + gapX / 2 : 0;
  px(mainHead.value, "height", head ? head + gapY : 0);
  px(mainRashi.value, "width", hasRashi ? sideWidth + gapX : 0);
  px(mainTosafot.value, "width", hasTosafot ? sideWidth + gapX : 0);
  for (const [headEl, columnEl, belowEl] of [
    [rashiHead.value, rashiColumn.value, rashiBelow.value],
    [tosafotHead.value, tosafotColumn.value, tosafotBelow.value],
  ]) {
    px(headEl, "width", half);
    px(headEl, "height", head);
    px(columnEl, "width", width - sideWidth);
    // Sous la guemara, chacun sa moitié ; seul, le commentaire prend la largeur.
    px(belowEl, "width", half);
  }

  // 1. Chaque commentaire dans sa colonne, jusqu'en bas.
  px(rashiColumn.value, "height", ENDLESS);
  px(tosafotColumn.value, "height", ENDLESS);
  px(rashiBelow.value, "height", 0);
  px(tosafotBelow.value, "height", 0);
  px(mainRashi.value, "height", hasRashi ? ENDLESS : 0);
  px(mainTosafot.value, "height", hasTosafot ? ENDLESS : 0);
  let top = el.getBoundingClientRect().top;
  const rashiBottom = hasRashi ? bottomOf(rashiEnd.value, top) : 0;
  const tosafotBottom = hasTosafot ? bottomOf(tosafotEnd.value, top) : 0;

  // 2. La guemara entre les deux : elle s'élargit sous le commentaire fini.
  const mainTop = head ? head + gapY : 0;
  const besides = (bottom: number): number => Math.max(0, bottom + gapY - mainTop);
  px(mainRashi.value, "height", hasRashi ? besides(rashiBottom) : 0);
  px(mainTosafot.value, "height", hasTosafot ? besides(tosafotBottom) : 0);
  top = el.getBoundingClientRect().top;
  const mainBottom = bottomOf(mainEnd.value, top);

  // 3. Le commentaire plus long que la guemara passe dessous, dans sa moitié.
  const columns = dafColumns({
    head,
    rashiEnd: rashiBottom,
    tosafotEnd: tosafotBottom,
    mainEnd: mainBottom,
    sideLine,
    gap: gapY,
  });
  if (columns.rashi !== null) {
    px(rashiColumn.value, "height", columns.rashi);
    px(rashiBelow.value, "height", ENDLESS);
  }
  if (columns.tosafot !== null) {
    px(tosafotColumn.value, "height", columns.tosafot);
    px(tosafotBelow.value, "height", ENDLESS);
  }

  // 4. Sous la guemara, chacun garde sa moitié tant que l'autre continue ;
  // quand l'un finit, celui qui reste reprend toute la largeur.
  if (columns.rashi !== null || columns.tosafot !== null) {
    top = el.getBoundingClientRect().top;
    const below = (column: number | null): number => head + (column ?? 0);
    const ends = {
      rashi: bottomOf(rashiEnd.value, top),
      tosafot: bottomOf(tosafotEnd.value, top),
    };
    const widen = (
      column: number | null,
      otherColumn: number | null,
      otherEnd: number,
      belowEl: HTMLElement | null,
    ): void => {
      if (column === null) return;
      // L'autre finit dans sa colonne : rien à côté, toute la largeur d'emblée.
      const until = otherColumn === null ? below(column) : otherEnd + gapY;
      const height = Math.max(0, until - below(column));
      px(belowEl, "height", Math.ceil(height / sideLine) * sideLine);
    };
    if (ends.rashi >= ends.tosafot) {
      widen(columns.rashi, columns.tosafot, ends.tosafot, rashiBelow.value);
    } else {
      widen(columns.tosafot, columns.rashi, ends.rashi, tosafotBelow.value);
    }
  }
  top = el.getBoundingClientRect().top;
  height.value = Math.ceil(
    Math.max(
      bottomOf(mainEnd.value, top),
      hasRashi ? bottomOf(rashiEnd.value, top) : 0,
      hasTosafot ? bottomOf(tosafotEnd.value, top) : 0,
    ) + 2,
  );
}

let frame = 0;
function scheduleLayout(): void {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => layout());
}

let lastWidth = 0;
let observer: ResizeObserver | null = null;
const onFonts = (): void => scheduleLayout();

onMounted(() => {
  layout();
  // La police de Rachi arrive après le premier rendu : la page se recompose.
  void document.fonts?.ready.then(() => scheduleLayout());
  document.fonts?.addEventListener?.("loadingdone", onFonts);
  if (typeof ResizeObserver !== "undefined" && root.value) {
    observer = new ResizeObserver(() => {
      const width = root.value?.clientWidth ?? 0;
      if (width && width !== lastWidth) {
        lastWidth = width;
        scheduleLayout();
      }
    });
    observer.observe(root.value);
  }
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  observer?.disconnect();
  document.fonts?.removeEventListener?.("loadingdone", onFonts);
});

watch(
  () => [props.scale, props.lines, props.meforshim],
  async () => {
    await nextTick();
    layout();
  },
);
</script>

<template>
  <div
    ref="root"
    class="daf-page"
    :style="{ height: height ? `${height}px` : undefined }"
    :data-amud="amudOf(daf)"
  >
    <!-- La guemara : un en-tête vide, puis un blanc de chaque côté, la
         colonne des commentaires. -->
    <div class="daf-layer" dir="rtl">
      <div ref="mainHead" class="daf-head-spacer"></div>
      <div
        ref="mainRashi"
        class="daf-spacer"
        :style="{ float: sides.rashi, clear: sides.rashi }"
      ></div>
      <div
        ref="mainTosafot"
        class="daf-spacer"
        :style="{ float: sides.tosafot, clear: sides.tosafot }"
      ></div>
      <p class="daf-main">
        <template v-for="(line, k) in mainLines" :key="k"
          ><span
            class="daf-passage"
            :class="{
              'daf-linkable': commented.has(line.passage),
              'daf-linked': linked?.passage === line.passage,
            }"
            :data-passage="line.passage"
            @click="touchPassage(line.passage)"
            ><MarkedText
              :text="line.text"
              :strong="line.strong"
              :leads="linked?.passage === line.passage ? linkedLeads : null" /></span
          >{{ " " }}</template
        ><span ref="mainEnd" class="daf-end"></span>
      </p>
    </div>

    <!-- Rachi : les blancs flottent du côté opposé au sien. -->
    <div class="daf-layer" dir="rtl">
      <div ref="rashiHead" class="daf-spacer" :style="{ float: sides.tosafot }"></div>
      <div
        ref="rashiColumn"
        class="daf-spacer"
        :style="{ float: sides.tosafot, clear: sides.tosafot }"
      ></div>
      <div
        ref="rashiBelow"
        class="daf-spacer"
        :style="{ float: sides.tosafot, clear: sides.tosafot }"
      ></div>
      <p class="daf-side">
        <template v-for="(c, i) in rashi" :key="i"
          ><span
            class="daf-comment"
            :class="{
              'daf-linkable': c.passage !== undefined,
              'daf-linked': isLinked('rashi', i, c),
            }"
            :data-passage="c.passage"
            @click="touchComment('rashi', i, c)"
            ><b v-if="c.lead" class="daf-lead">{{ c.lead }}</b
            >{{ c.lead ? " " : "" }}{{ c.text }}</span
          >{{ " " }}</template
        >
        <span ref="rashiEnd" class="daf-end"></span>
      </p>
    </div>

    <!-- Tossafot : symétrique de Rachi. -->
    <div class="daf-layer" dir="rtl">
      <div ref="tosafotHead" class="daf-spacer" :style="{ float: sides.rashi }"></div>
      <div
        ref="tosafotColumn"
        class="daf-spacer"
        :style="{ float: sides.rashi, clear: sides.rashi }"
      ></div>
      <div
        ref="tosafotBelow"
        class="daf-spacer"
        :style="{ float: sides.rashi, clear: sides.rashi }"
      ></div>
      <p class="daf-side">
        <template v-for="(c, i) in tosafot" :key="i"
          ><span
            class="daf-comment"
            :class="{
              'daf-linkable': c.passage !== undefined,
              'daf-linked': isLinked('tosafot', i, c),
            }"
            :data-passage="c.passage"
            @click="touchComment('tosafot', i, c)"
            ><b v-if="c.lead" class="daf-lead">{{ c.lead }}</b
            >{{ c.lead ? " " : "" }}{{ c.text }}</span
          >{{ " " }}</template
        >
        <span ref="tosafotEnd" class="daf-end"></span>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* La page : ce qui dépasse des calques (les blancs « jusqu'en bas ») est
   rogné à la hauteur mesurée. */
.daf-page {
  position: relative;
  overflow: hidden;
  /* Les mesures d'une page ne relancent pas la mise en page de tout le
     chapitre : un chapitre en compte une vingtaine, trois passes chacune. */
  contain: layout;
  min-height: 4rem;
  color: var(--color-text-primary);
}

/* Trois calques superposés, de la largeur de la page. Ils laissent passer
   le doigt : seul le texte le reçoit, quel que soit le calque au-dessus. */
.daf-layer {
  position: absolute;
  inset: 0 0 auto 0;
  pointer-events: none;
}

.daf-spacer,
.daf-head-spacer {
  height: 0;
}

.daf-main,
.daf-side {
  text-align: justify;
  text-align-last: center;
  hyphens: none;
}

/* Le doigt ne touche que le texte : un paragraphe couvre toute la largeur du
   calque, blancs compris, et celui du dessus cacherait les deux autres. */
.daf-passage,
.daf-comment {
  pointer-events: auto;
  border-radius: var(--radius-sm);
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  transition: background-color 0.2s;
}

/* Un passage que Rachi ou Tossafot explique, un commentaire : on les touche
   pour voir à quoi ils répondent. */
.daf-linkable {
  cursor: pointer;
}

@media (hover: hover) {
  .daf-linkable:hover {
    background-color: color-mix(in srgb, var(--color-primary) 9%, transparent);
  }
}

/* Le passage et ses commentaires, surlignés ensemble : la couleur du passage
   choisi partout dans la lecture (`.reading-selected`). */
.daf-linked,
.daf-linkable.daf-linked:hover {
  background-color: var(--color-selection);
}

/* La guemara en lettres carrées, dans la police hébraïque du lecteur. */
.daf-main {
  font-family: var(--font-hebrew);
  font-size: var(--daf-main-size, 1rem);
  line-height: var(--daf-main-line, 1.4);
}

/* Les commentaires en écriture de Rachi, le dibbour hamat'hil en carré gras,
   comme sur la page imprimée. */
.daf-side {
  font-family: "Noto Rashi Hebrew", var(--font-hebrew);
  font-size: var(--daf-side-size, 0.75rem);
  line-height: var(--daf-side-line, 1.38);
}

.daf-lead {
  font-family: var(--font-hebrew);
  font-weight: 700;
}

.daf-end {
  display: inline-block;
  width: 0;
  height: 1em;
  vertical-align: bottom;
}
</style>
