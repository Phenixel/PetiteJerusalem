<script setup lang="ts">
/**
 * Un volume de l'étagère de Mon parcours : un objectif, un volume (voir
 * docs/design.md, « Un objectif, un volume »).
 *
 * Sa taille dit sa longueur : un traité seul est un petit livre, un séder un
 * volume, plusieurs sedarim un volume plus épais, tout le Chass le plus gros.
 * Son titre dit ce qu'on a pris, sur une ou deux lignes. Le liseré doré fait
 * le tour de la couverture à mesure qu'on avance ; le signet rouge pend quand
 * une portion attend aujourd'hui.
 */
import { computed } from "vue";

export type VolumeFormat = "small" | "regular" | "thick" | "large";

const props = withDefaults(
  defineProps<{
    color: string;
    /** Le titre, une ou deux lignes : « Moed », ou « Moed » et « Nachim ». */
    lines: string[];
    /** Sous le titre, plus petit : « Michna », « la semaine ». */
    sub?: string;
    /** L'avancement, de 0 à 1. */
    progress: number;
    /** Une portion attend aujourd'hui. */
    ribbon?: boolean;
    format?: VolumeFormat;
  }>(),
  { sub: "", ribbon: false, format: "regular" },
);

/** La couverture (largeur, hauteur) et l'épaisseur des pages, en unités du dessin. */
const SHAPES: Record<VolumeFormat, { cover: [number, number]; pages: number; font: number }> = {
  small: { cover: [62, 100], pages: 5, font: 13 },
  regular: { cover: [84, 134], pages: 9, font: 15 },
  thick: { cover: [84, 134], pages: 16, font: 14 },
  large: { cover: [88, 140], pages: 22, font: 15 },
};
/** L'échelle commune des volumes : 96 unités font 84 px, comme ceux de l'accueil. */
const SCALE = 0.875;

const shape = computed(() => {
  const { cover, pages, font } = SHAPES[props.format];
  const [cw, ch] = cover;
  const small = cw < 70;
  // Le cadre doré, rentré du dos (à gauche) plus que du bord.
  const left = small ? 14 : 18;
  const right = 3 + cw - (small ? 6 : 7);
  const top = small ? 11 : 14;
  const bottom = 3 + ch - (small ? 9 : 11);
  const middle = (left + right) / 2;
  const leaves = Array.from(
    { length: Math.max(1, Math.floor((pages - 3) / 3)) },
    (_, i) => `M${cw + 3 + i * 3} 10v${ch - 14}`,
  ).join("");
  // Un titre long rétrécit plutôt que de déborder de la couverture.
  const longest = Math.max(...props.lines.map((line) => line.length), 1);
  const fontSize = Math.min(font, ((right - left - 8) / longest) * 1.9);
  const firstLine = 3 + ch * 0.42 - ((props.lines.length - 1) * (fontSize + 3)) / 2;
  return {
    width: (cw + pages + 3) * SCALE,
    height: (ch + 18) * SCALE,
    viewBox: `0 0 ${cw + pages + 3} ${ch + 18}`,
    cw,
    ch,
    pages,
    leaves,
    frame: `M${middle} ${top}H${right}V${bottom}H${left}V${top}Z`,
    middle,
    fontSize,
    firstLine,
    subY: firstLine + (props.lines.length - 1) * (fontSize + 3) + 18,
    ribbonX: Math.round(3 + cw * 0.7),
  };
});

/** Le liseré : sa part du tour de la couverture, au moins un trait quand on a commencé. */
const dash = computed(() => {
  const share = Math.min(1, Math.max(0, props.progress));
  return `${share > 0 ? Math.max(1, Math.round(share * 100)) : 0} 100`;
});
</script>

<template>
  <svg :width="shape.width" :height="shape.height" :viewBox="shape.viewBox" aria-hidden="true">
    <rect :x="shape.cw" y="6" :width="shape.pages" :height="shape.ch - 6" rx="2" class="pages" />
    <path :d="shape.leaves" class="leaves" />
    <rect x="3" y="3" :width="shape.cw" :height="shape.ch" rx="4" :fill="color" />
    <rect x="3" y="3" width="7" :height="shape.ch" rx="3.5" class="spine" />
    <path :d="shape.frame" class="frame" />
    <path :d="shape.frame" pathLength="100" :stroke-dasharray="dash" class="frame-gold" />
    <text
      v-for="(line, i) in lines"
      :key="i"
      :x="shape.middle"
      :y="shape.firstLine + i * (shape.fontSize + 3)"
      text-anchor="middle"
      class="title"
      :style="{ fontSize: `${shape.fontSize}px` }"
    >
      {{ line }}
    </text>
    <text v-if="sub" :x="shape.middle" :y="shape.subY" text-anchor="middle" class="sub">
      {{ sub }}
    </text>
    <path
      v-if="ribbon"
      :d="`M${shape.ribbonX} ${shape.ch}H${shape.ribbonX + 6}V${shape.ch + 16}L${shape.ribbonX + 3} ${shape.ch + 12.5}L${shape.ribbonX} ${shape.ch + 16}Z`"
      class="ribbon"
    />
  </svg>
</template>

<style scoped>
.pages {
  fill: #efe5d0;
}
.leaves {
  stroke: #d6c8ab;
  stroke-width: 0.8;
  fill: none;
}
.spine {
  fill: #000;
  opacity: 0.16;
}
.frame {
  fill: none;
  stroke: #ecdfc4;
  stroke-width: 1.4;
  opacity: 0.35;
}
.frame-gold {
  fill: none;
  stroke: #e2c06a;
  stroke-width: 2.2;
}
.title {
  fill: #f3ead6;
  font-family: var(--font-serif), serif;
  font-weight: 600;
}
.sub {
  fill: #ecdfc4;
  opacity: 0.75;
  font-family: var(--font-serif), serif;
  font-size: 10px;
  font-weight: 600;
}
.ribbon {
  fill: #b3262f;
}
</style>
