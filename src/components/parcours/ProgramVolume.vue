<script setup lang="ts">
/**
 * Un volume de l'étagère de Mon parcours : un objectif, un volume (voir
 * docs/design.md, « One goal, one volume »).
 *
 * Tous les volumes ont la même couverture, pour se tenir droits côte à côte
 * sur la planche ; c'est leur **épaisseur** qui dit leur longueur : un traité
 * seul est mince, un séder ordinaire, plusieurs sedarim plus épais, tout le
 * Chass le plus épais.
 *
 * Relié comme le sidour (ArtSiddur) : le dos plus clair et ses nerfs dorés,
 * un double filet doré autour du titre, le titre en lettres dorées et un
 * fleuron dessous. Le filet extérieur est le liseré qui se remplit à mesure
 * qu'on avance ; le signet rouge pend quand une portion attend aujourd'hui.
 *
 * Le titre tient dans son cadre : il passe sur plusieurs lignes, mot par mot,
 * et rapetisse s'il le faut ; jamais il ne déborde du liseré.
 */
import { computed } from "vue";

export type VolumeFormat = "small" | "regular" | "thick" | "large";

const props = withDefaults(
  defineProps<{
    color: string;
    /** Le titre : « Moed », ou « Moed » et « Nachim » ; une ligne trop longue se coupe. */
    lines: string[];
    /** Sous le titre, plus petit : « Michna », « la semaine ». */
    sub?: string;
    /** L'avancement, de 0 à 1. */
    progress: number;
    /** Une portion attend aujourd'hui. */
    ribbon?: boolean;
    format?: VolumeFormat;
    /** L'échelle du dessin : 96 unités font 84 px sur l'étagère, 150 px en grand (P2-Programme). */
    scale?: number;
  }>(),
  { sub: "", ribbon: false, format: "regular", scale: 0.875 },
);

/** La couverture, la même pour tous (unités du dessin). */
const COVER_W = 84;
const COVER_H = 134;

/** L'épaisseur des pages : elle seule dit la longueur de ce qu'on lit. */
const PAGES: Record<VolumeFormat, number> = { small: 5, regular: 9, thick: 15, large: 21 };

/** Le cadre doré, rentré du dos (à gauche) plus que du bord. */
const FRAME = { left: 18, right: 3 + COVER_W - 7, top: 14, bottom: 3 + COVER_H - 11 };
/** La place du texte dans le cadre, filet intérieur et marges compris. */
const TEXT_WIDTH = FRAME.right - FRAME.left - 13;
const MIDDLE = (FRAME.left + FRAME.right) / 2;

/** La largeur moyenne d'une lettre du serif, en part de sa taille. */
const CHAR = 0.55;
const widthOf = (text: string, size: number): number => text.length * size * CHAR;

/**
 * Une ligne en hébreu ne se resserre pas par `textLength` : WebKit (Safari,
 * l'app iPhone) pose alors chaque lettre l'une après l'autre, de gauche à
 * droite, et l'hébreu se lit à l'envers. Elle rapetisse à la place.
 */
const HEBREW = /[\u0590-\u05ff]/;

/** Les mots d'une ligne, rangés sur autant de lignes qu'il en faut à cette taille. */
function wrap(text: string, size: number): string[] {
  const out: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    const last = out[out.length - 1];
    if (last !== undefined && widthOf(`${last} ${word}`, size) <= TEXT_WIDTH) {
      out[out.length - 1] = `${last} ${word}`;
    } else out.push(word);
  }
  return out;
}

/**
 * La plus grande taille où tout tient. D'abord chaque ligne entière, en
 * rapetissant jusqu'à `oneLine` (« Tehilim 1 » ne se coupe pas pour si peu) ;
 * puis mot par mot, sur `maxLines` lignes au plus. Un mot plus large que le
 * cadre même à la plus petite taille se resserre (`squeeze`, voir
 * textLength) plutôt que de déborder.
 */
function fit(lines: string[], max: number, oneLine: number, min: number, maxLines: number) {
  const source = lines.map((line) => line.trim()).filter(Boolean);
  const fits = (out: string[], size: number) =>
    out.length <= maxLines && out.every((line) => widthOf(line, size) <= TEXT_WIDTH);
  const done = (out: string[], size: number) => ({
    size,
    lines: out.map((text) => {
      const wide = widthOf(text, size) > TEXT_WIDTH;
      if (wide && HEBREW.test(text)) {
        return { text, squeeze: false, size: (size * TEXT_WIDTH) / widthOf(text, size) };
      }
      return { text, squeeze: wide, size };
    }),
  });
  for (let size = max; size >= oneLine; size -= 0.5) {
    if (fits(source, size)) return done(source, size);
  }
  for (let size = max; size >= min; size -= 0.5) {
    const out = source.flatMap((line) => wrap(line, size));
    if (fits(out, size)) return done(out, size);
  }
  return done(source.flatMap((line) => wrap(line, min)).slice(0, maxLines), min);
}

const layout = computed(() => {
  const pages = PAGES[props.format];
  const title = fit(props.lines, 15, 11, 9, 3);
  const sub = props.sub ? fit([props.sub], 9.5, 7, 7, 2) : { size: 0, lines: [] };
  const titleStep = title.size * 1.12;
  const subStep = sub.size * 1.2;
  // Le titre, le fleuron, le sous-titre : un bloc, centré un peu haut dans le cadre.
  const ornament = 9;
  const height =
    title.lines.length * titleStep +
    ornament +
    (sub.lines.length ? sub.lines.length * subStep + 4 : 0);
  const top = 3 + COVER_H * 0.45 - height / 2;
  const titleY = (i: number) => top + title.size * 0.85 + i * titleStep;
  const ornamentY = top + title.lines.length * titleStep + ornament / 2;
  const subY = (i: number) => ornamentY + ornament / 2 + 4 + sub.size * 0.85 + i * subStep;
  const leaves = Array.from(
    { length: Math.max(1, Math.floor((pages - 3) / 3)) },
    (_, i) => `M${COVER_W + 3 + i * 3} 10v${COVER_H - 14}`,
  ).join("");
  return {
    pages,
    width: (COVER_W + pages + 3) * props.scale,
    height: (COVER_H + 18) * props.scale,
    viewBox: `0 0 ${COVER_W + pages + 3} ${COVER_H + 18}`,
    leaves,
    title: title.lines.map((line, i) => ({ ...line, y: titleY(i) })),
    ornamentY,
    sub: sub.lines.map((line, i) => ({ ...line, y: subY(i) })),
    ribbonX: Math.round(3 + COVER_W * 0.7),
  };
});

/** Le liseré extérieur, qui part du milieu du haut et fait le tour. */
const FRAME_PATH = `M${MIDDLE} ${FRAME.top}H${FRAME.right}V${FRAME.bottom}H${FRAME.left}V${FRAME.top}Z`;

/** Le liseré : sa part du tour de la couverture, au moins un trait quand on a commencé. */
const dash = computed(() => {
  const share = Math.min(1, Math.max(0, props.progress));
  return `${share > 0 ? Math.max(1, Math.round(share * 100)) : 0} 100`;
});

/** Les nerfs du dos : deux paires de filets dorés, en haut et en bas. */
const BANDS = [0.13, 0.17, 0.83, 0.87].map((share) => `M4 ${3 + COVER_H * share}H11`).join("");
</script>

<template>
  <svg :width="layout.width" :height="layout.height" :viewBox="layout.viewBox" aria-hidden="true">
    <!-- La tranche des pages, ses feuillets en traits fins. -->
    <rect :x="COVER_W" y="6" :width="layout.pages" :height="COVER_H - 6" rx="2" class="pages" />
    <path :d="layout.leaves" class="leaves" />
    <!-- Le plat, le dos plus clair et sa charnière, ses nerfs dorés. -->
    <rect x="3" y="3" :width="COVER_W" :height="COVER_H" rx="4" :fill="color" />
    <rect x="3" y="3" width="9" :height="COVER_H" rx="3.5" class="spine" />
    <path :d="`M12 4V${COVER_H + 2}`" class="hinge" />
    <path :d="BANDS" class="band" />
    <!-- Le double filet : le liseré qui se remplit, et le filet fin dedans. -->
    <path :d="FRAME_PATH" class="frame" />
    <path :d="FRAME_PATH" pathLength="100" :stroke-dasharray="dash" class="frame-gold" />
    <rect
      :x="FRAME.left + 3.5"
      :y="FRAME.top + 3.5"
      :width="FRAME.right - FRAME.left - 7"
      :height="FRAME.bottom - FRAME.top - 7"
      rx="1"
      class="filet"
    />
    <!-- Le titre doré, le fleuron, le sous-titre. -->
    <text
      v-for="(line, i) in layout.title"
      :key="`t${i}`"
      :x="MIDDLE"
      :y="line.y"
      text-anchor="middle"
      class="title"
      :style="{ fontSize: `${line.size}px` }"
      :textLength="line.squeeze ? TEXT_WIDTH : undefined"
      :lengthAdjust="line.squeeze ? 'spacingAndGlyphs' : undefined"
    >
      {{ line.text }}
    </text>
    <path
      :d="`M${MIDDLE} ${layout.ornamentY - 3}L${MIDDLE + 2.6} ${layout.ornamentY}L${MIDDLE} ${layout.ornamentY + 3}L${MIDDLE - 2.6} ${layout.ornamentY}Z`"
      class="gold"
    />
    <path
      :d="`M${MIDDLE - 13} ${layout.ornamentY}H${MIDDLE - 5}M${MIDDLE + 5} ${layout.ornamentY}H${MIDDLE + 13}`"
      class="ornament-line"
    />
    <text
      v-for="(line, i) in layout.sub"
      :key="`s${i}`"
      :x="MIDDLE"
      :y="line.y"
      text-anchor="middle"
      class="sub"
      :style="{ fontSize: `${line.size}px` }"
      :textLength="line.squeeze ? TEXT_WIDTH : undefined"
      :lengthAdjust="line.squeeze ? 'spacingAndGlyphs' : undefined"
    >
      {{ line.text }}
    </text>
    <path
      v-if="ribbon"
      :d="`M${layout.ribbonX} ${COVER_H}H${layout.ribbonX + 6}V${COVER_H + 16}L${layout.ribbonX + 3} ${COVER_H + 12.5}L${layout.ribbonX} ${COVER_H + 16}Z`"
      class="ribbon"
    />
  </svg>
</template>

<style scoped>
/* Les couleurs de l'objet, hors thème comme les reliures : le papier, la dorure. */
.pages {
  fill: #efe5d0;
}
.leaves {
  stroke: #d6c8ab;
  stroke-width: 0.8;
  fill: none;
}
/* Le dos, un ton plus clair que le plat, et la charnière qui l'en sépare. */
.spine {
  fill: #fff;
  opacity: 0.1;
}
.hinge {
  stroke: #000;
  stroke-width: 0.8;
  opacity: 0.22;
}
.band {
  stroke: #e2c06a;
  stroke-width: 0.9;
  opacity: 0.75;
}
.frame {
  fill: none;
  stroke: #ecdfc4;
  stroke-width: 1.4;
  opacity: 0.3;
}
.frame-gold {
  fill: none;
  stroke: #e2c06a;
  stroke-width: 2.2;
}
.filet {
  fill: none;
  stroke: #e2c06a;
  stroke-width: 0.6;
  opacity: 0.55;
}
.title {
  fill: #ecd28e;
  font-family: var(--font-serif), serif;
  font-weight: 700;
}
.gold {
  fill: #e2c06a;
}
.ornament-line {
  stroke: #e2c06a;
  stroke-width: 0.9;
}
.sub {
  fill: #f1e6cd;
  opacity: 0.8;
  font-family: var(--font-serif), serif;
  font-weight: 600;
}
.ribbon {
  fill: #b3262f;
}
</style>
