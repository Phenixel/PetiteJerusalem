<script lang="ts">
/** Ce que dessine une carte mise en avant. */
export type CardArtSpec =
  | {
      kind: "moon";
      /** L'âge de la lune, en jours depuis le molad : le dessin suit sa phase. */
      age: number;
    }
  | {
      kind: "hanoukia";
      /** Le soir de 'Hanouka, de 1 à 8 : autant de bougies. */
      night: number;
      /** Allumée (le soir venu), ou les bougies posées pour ce soir. */
      lit: boolean;
    }
  | { kind: "siddur" }
  | {
      kind: "volume";
      /** La reliure du corpus (config/bindings.ts). */
      color: string;
      /** Le titre de la couverture : « Moed », « Tehilim ». */
      label: string;
    }
  | { kind: "shofar" }
  | { kind: "loulav" }
  | { kind: "omer" };

type ArtKind = CardArtSpec["kind"];

/**
 * Où chaque objet se pose, en fractions de sa hauteur `size` : ses
 * proportions (`aspect`, largeur sur hauteur), ce qui dépasse du haut de la
 * carte (`rise`), et son retrait du bord de fin de ligne (`end`, négatif
 * quand le bord le coupe).
 *
 * La lune déborde du côté : le bord de la carte la coupe, mais seulement sous
 * le haut de la carte. Son centre est à 0,36 de sa taille du bord, et à 0,33
 * sous le haut de la carte ; à cette hauteur-là, le disque (rayon 0,48) ne
 * s'étend qu'à 0,35 de part et d'autre du centre : il tient dans la carte, et
 * ce qui dépasse en haut (0,15 de sa taille) est une calotte entière, sans
 * coupe droite.
 *
 * Aucun objet ne prend plus de `MAX_SHARE` de la largeur de la carte : sur un
 * petit téléphone, il rapetisse plutôt que de manger le titre.
 */
export const CARD_ART_GEOMETRY: Record<
  ArtKind,
  { size: number; aspect: number; rise: number; end: number }
> = {
  moon: { size: 150, aspect: 1, rise: 0.17, end: -0.14 },
  hanoukia: { size: 150, aspect: 100 / 140, rise: 0.19, end: 0.04 },
  siddur: { size: 150, aspect: 100 / 130, rise: 0.1, end: 0.03 },
  volume: { size: 150, aspect: 100 / 130, rise: 0.1, end: 0.03 },
  shofar: { size: 165, aspect: 100 / 140, rise: 0.14, end: 0.02 },
  loulav: { size: 185, aspect: 100 / 150, rise: 0.11, end: 0.03 },
  omer: { size: 140, aspect: 100 / 120, rise: 0.1, end: 0.04 },
};

const MAX_SHARE = 0.42;

/**
 * Les dessins déjà levés depuis l'ouverture de l'app : un objet ne se lève
 * qu'une fois par session et par carte. Revenir sur la page le trouve à sa
 * place.
 */
const played = new Set<string>();
</script>

<script setup lang="ts">
/**
 * L'objet d'une carte mise en avant : le sidour pour un office, le volume
 * d'un programme de Mon parcours, la lune les
 * nuits où on la bénit, la 'hanoukkia les soirs de 'Hanouka, le chofar des
 * Sli'hot, le loulav et l'etrog de Souccot, la gerbe du 'Omer (les dessins
 * sont dans components/art). Il tranche sur le reste de la page par ses
 * couleurs, celles de l'objet, en aplats et sans dégradé (voir
 * docs/design.md, « A highlighted card can carry its object »).
 *
 * Il se pose dans le coin de fin de ligne de la carte (la droite en
 * français, la gauche en hébreu), derrière le texte, et ne sort de la carte
 * que par le haut. Sa taille est la sienne, pas celle de la carte : une
 * carte ne grandit pas pour lui faire de la place, c'est lui qui passe sous
 * le bord bas quand elle est courte.
 *
 * À sa première apparition de la session, il monte depuis le coin bas de la
 * carte, le bord bas faisant l'horizon ; la 'hanoukkia s'allume ensuite dans
 * l'ordre où on l'allume. Une fois par carte, jamais en mouvement réduit.
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { prefersLessMotion } from "../composables/useMotion";
import ArtHanoukia from "./art/ArtHanoukia.vue";
import ArtLoulav from "./art/ArtLoulav.vue";
import ArtMoon from "./art/ArtMoon.vue";
import ArtOmer from "./art/ArtOmer.vue";
import ArtShofar from "./art/ArtShofar.vue";
import ArtSiddur from "./art/ArtSiddur.vue";
import ArtVolume from "./art/ArtVolume.vue";

const props = withDefaults(
  defineProps<{
    art: CardArtSpec;
    /** L'échelle de l'objet : 1 sur la carte du Sidour, moins sur un bandeau. */
    scale?: number;
    /** Le fond de la carte : sa couleur pleine, ou la surface claire. */
    surface?: "color" | "plain";
  }>(),
  { scale: 1, surface: "color" },
);

// La largeur de la carte, suivie : l'objet s'y règle (voir MAX_SHARE).
const root = ref<HTMLElement | null>(null);
const cardWidth = ref(0);
let observer: ResizeObserver | null = null;

const frame = computed(() => {
  const g = CARD_ART_GEOMETRY[props.art.kind];
  const fit = cardWidth.value > 0 ? (cardWidth.value * MAX_SHARE) / g.aspect : Infinity;
  const size = Math.round(Math.min(g.size * props.scale, fit));
  return {
    "--art-size": `${size}px`,
    "--art-rise": `${Math.round(size * g.rise)}px`,
    "--art-end": `${Math.round(size * g.end)}px`,
    "--art-aspect": `${g.aspect}`,
  };
});

// Une fois par carte : la lune du bandeau de l'accueil (surface claire) et
// celle de la carte du Sidour (en couleur) ont chacune leur lever.
const playKey = computed(() => {
  const art = props.art;
  const detail =
    art.kind === "hanoukia"
      ? `-${art.night}-${art.lit}`
      : art.kind === "volume"
        ? `-${art.label}`
        : "";
  return `${art.kind}${detail}-${props.surface}`;
});
const rising = ref(false);
onMounted(() => {
  if (root.value && typeof ResizeObserver !== "undefined") {
    cardWidth.value = root.value.offsetWidth;
    observer = new ResizeObserver(() => {
      if (root.value) cardWidth.value = root.value.offsetWidth;
    });
    observer.observe(root.value);
  }
  if (played.has(playKey.value)) return;
  played.add(playKey.value);
  rising.value = !prefersLessMotion();
});
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <span
    ref="root"
    class="card-art"
    :class="[`card-art-${surface}`, `card-art-${art.kind}`, { 'card-art-rising': rising }]"
    :style="frame"
    aria-hidden="true"
  >
    <ArtMoon v-if="art.kind === 'moon'" class="art" :age="art.age" />
    <ArtHanoukia
      v-else-if="art.kind === 'hanoukia'"
      class="art"
      :night="art.night"
      :lit="art.lit"
      :rising="rising"
    />
    <ArtSiddur v-else-if="art.kind === 'siddur'" class="art" />
    <ArtVolume
      v-else-if="art.kind === 'volume'"
      class="art"
      :color="art.color"
      :label="art.label"
    />
    <ArtShofar v-else-if="art.kind === 'shofar'" class="art" />
    <ArtLoulav v-else-if="art.kind === 'loulav'" class="art" />
    <ArtOmer v-else class="art" />
  </span>
</template>

<style scoped>
/* La boîte du dessin couvre la carte et la déborde par le haut ; elle coupe ce
   qui sortirait par les côtés ou par le bas, aux coins arrondis de la carte. */
.card-art {
  position: absolute;
  inset: calc(var(--art-rise) * -1) 0 0 0;
  pointer-events: none;
  clip-path: inset(0 round 0 0 var(--radius-card) var(--radius-card));

  /* La lune : les gris de la vraie, les hautes terres claires, les mers plus
     sombres. Ses couleurs changent avec la surface de la carte, jamais avec
     le thème. La part sombre est la lumière cendrée, un voile à peine plus
     clair que le fond. */
  --moon-highland: #e2ded4;
  --moon-mare: #aaa597;
  --moon-mare-deep: #959186;
  --moon-bright: #f7f5ef;
  --moon-pit: #d6d2c8;
  --moon-dark: rgb(255 255 255 / 0.14);
}

/* Sur une surface claire, la lune prend des tons plus soutenus pour se
   détacher du blanc, et sa part sombre devient une ombre légère. */
.card-art-plain {
  --moon-highland: #d9d4c8;
  --moon-mare: #a29d90;
  --moon-mare-deep: #928e83;
  --moon-pit: #cbc6ba;
  --moon-dark: rgb(15 20 40 / 0.07);
}
:root.dark .card-art-plain {
  --moon-dark: rgb(255 255 255 / 0.08);
  /* Le cuir bleu nuit du sidour se confond avec une carte sombre : un liseré
     clair en garde le contour. */
  --art-outline: rgb(255 255 255 / 0.3);
}

.art {
  position: absolute;
  top: 0;
  inset-inline-end: var(--art-end);
  height: var(--art-size);
  aspect-ratio: var(--art-aspect);
  overflow: visible;
  /* Une ombre portée, comme celle des cartes : ce qui dépasse en haut se
     détache du fond de la page, la lune claire sur le beige surtout. */
  filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.2));
}
:root.perf-lite .art {
  filter: none;
}

/* --- Le lever, une fois par session et par carte ------------------------- */
/* L'objet part du coin bas, sous le bord de la carte, et monte en biais. */
.card-art-rising .art {
  animation: art-rise 1.3s cubic-bezier(0.2, 0.7, 0.25, 1) both;
}
.card-art-rising.card-art-moon .art {
  animation-duration: 1.8s;
}
[dir="rtl"] .card-art-rising .art {
  animation-name: art-rise-rtl;
}
@keyframes art-rise {
  from {
    transform: translate(30%, 115%);
  }
  to {
    transform: none;
  }
}
@keyframes art-rise-rtl {
  from {
    transform: translate(-30%, 115%);
  }
  to {
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .card-art-rising .art {
    animation: none;
  }
}
</style>
