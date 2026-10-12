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
    };

/**
 * Les dessins déjà montés depuis l'ouverture de l'app : la lune ne se lève
 * qu'une fois par session. Revenir sur la page la trouve à sa place.
 */
const played = new Set<string>();
</script>

<script setup lang="ts">
/**
 * Le dessin d'une carte mise en avant : la lune les nuits où on la bénit, la
 * 'hanoukkia les soirs de 'Hanouka. Il tranche sur le reste de la page par
 * ses couleurs, celles de l'objet (l'argent, la cire, la flamme, la lune),
 * en aplats et sans dégradé (voir docs/design.md, « Une carte mise en avant
 * peut porter son objet »).
 *
 * Il se pose dans un coin bas de la carte, du côté de la fin de ligne (la
 * droite en français, la gauche en hébreu) : il reste dans la carte sur
 * trois côtés, et ne dépasse que du bord haut, de `rise` pixels. La carte
 * lui laisse la place de son texte (voir `pe-*` chez qui l'emploie).
 *
 * À sa première apparition de la session, il monte depuis le bas de la carte,
 * comme la lune se lève : le bord bas fait l'horizon. La 'hanoukkia s'allume
 * ensuite, le chamach d'abord, puis la bougie du soir, la plus à gauche, et
 * les autres vers la droite, dans l'ordre où on les allume. Une fois, et pas
 * à chaque retour sur la page ; jamais en mouvement réduit.
 */
import { computed, onMounted, ref, useId } from "vue";
import { prefersLessMotion } from "../composables/useMotion";

const props = withDefaults(
  defineProps<{
    art: CardArtSpec;
    /** Ce qui dépasse du bord haut de la carte, en pixels. */
    rise?: number;
    /** La taille de la lune, en pixels (la 'hanoukkia, elle, suit la carte). */
    size?: number;
    /** Le fond de la carte : sa couleur pleine, ou la surface claire. */
    surface?: "color" | "plain";
  }>(),
  { rise: 24, size: 132, surface: "color" },
);

const id = useId();
// Une fois par carte : la lune du bandeau de l'accueil (surface claire) et
// celle de la carte du Sidour (en couleur) ont chacune leur lever.
const playKey = computed(() =>
  props.art.kind === "moon"
    ? `moon-${props.surface}`
    : `hanoukia-${props.art.night}-${props.art.lit}-${props.surface}`,
);
const rising = ref(false);
onMounted(() => {
  if (played.has(playKey.value)) return;
  played.add(playKey.value);
  rising.value = !prefersLessMotion();
});

// --- La lune ------------------------------------------------------------------
// Un disque de rayon 48 au centre d'un carré de 100. La part éclairée suit la
// phase : le limbe d'un côté, le terminateur (une demi-ellipse) de l'autre.
const SYNODIC_MONTH = 29.530589;

const moonLit = computed(() => {
  if (props.art.kind !== "moon") return "";
  const phase = (((props.art.age / SYNODIC_MONTH) % 1) + 1) % 1;
  const waxing = phase < 0.5;
  const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const r = 48;
  const rx = Math.abs(1 - 2 * lit) * r;
  // Croissante, la lune s'éclaire par la droite (vue de l'hémisphère nord) ;
  // décroissante, par la gauche. Le terminateur bombe vers le côté sombre
  // passé le premier quartier.
  const limb = waxing ? 1 : 0;
  const bulge = lit > 0.5 === waxing ? 1 : 0;
  return `M50 2A${r} ${r} 0 0 ${limb} 50 98A${rx.toFixed(2)} ${r} 0 0 ${bulge} 50 2Z`;
});

/**
 * Les mers de la face visible, à grands traits : des ellipses qui se
 * chevauchent et dessinent ensemble le réseau sombre qu'on reconnaît à l'œil
 * nu, l'Océan des Tempêtes à l'ouest, les Pluies au nord, la Sérénité et la
 * Tranquillité au centre, les Crises au bord est.
 */
const MARIA = [
  { cx: 48, cy: 17, rx: 17, ry: 3, rot: -4 }, // Mer du Froid
  { cx: 36, cy: 31, rx: 12, ry: 9.5, rot: -10 }, // Mer des Pluies
  { cx: 21, cy: 45, rx: 9, ry: 13, rot: 8 }, // Océan des Tempêtes
  { cx: 25, cy: 62, rx: 8, ry: 9, rot: 0 },
  { cx: 41, cy: 64, rx: 9, ry: 5.5, rot: -8 }, // Mer des Nuées
  { cx: 58, cy: 32, rx: 7, ry: 6.5, rot: 0 }, // Mer de la Sérénité
  { cx: 63, cy: 46, rx: 9, ry: 6.5, rot: 15 }, // Mer de la Tranquillité
  { cx: 56, cy: 52, rx: 5, ry: 4, rot: 0 },
  { cx: 75, cy: 59, rx: 4.5, ry: 7.5, rot: 12 }, // Mer de la Fécondité
  { cx: 65, cy: 63, rx: 3.5, ry: 3.5, rot: 0 }, // Mer du Nectar
  { cx: 83, cy: 37, rx: 5, ry: 4, rot: 0 }, // Mer des Crises
];

/** Quelques cratères, plus clairs que la plaine : Tycho, Copernic, Kepler... */
const CRATERS = [
  { cx: 46, cy: 82, r: 2.4 },
  { cx: 34, cy: 47, r: 1.9 },
  { cx: 23, cy: 46, r: 1.2 },
  { cx: 57, cy: 76, r: 1.4 },
  { cx: 71, cy: 25, r: 1.1 },
  { cx: 87, cy: 53, r: 1 },
];

// --- La 'hanoukkia ------------------------------------------------------------
// Dessinée dans 100 × 135, le pied en bas : huit branches sur une barre, le
// chamach au milieu, plus haut.
const BRANCHES = [7, 17.5, 28, 38.5, 61.5, 72, 82.5, 93];
const SHAMASH = 50;

const night = computed(() =>
  props.art.kind === "hanoukia" ? Math.min(8, Math.max(1, Math.round(props.art.night))) : 0,
);
const lit = computed(() => props.art.kind === "hanoukia" && props.art.lit);

/**
 * Les bougies du soir : on les pose de droite à gauche, une de plus chaque
 * soir, et on allume la dernière posée en premier. `order` est le rang
 * d'allumage, après le chamach.
 */
const candles = computed(() =>
  BRANCHES.map((x, i) => {
    const placed = i >= BRANCHES.length - night.value;
    return { x, placed, order: i - (BRANCHES.length - night.value) + 1 };
  }).filter((candle) => candle.placed),
);

/** Une flamme dont la pointe est en (x, top), haute de 10. */
function flame(x: number, top: number): string {
  return `M${x} ${top}C${x + 3.4} ${top + 4} ${x + 3} ${top + 10} ${x} ${top + 10}C${x - 3} ${top + 10} ${x - 3.4} ${top + 4} ${x} ${top}Z`;
}
function flameCore(x: number, top: number): string {
  return `M${x} ${top + 4}C${x + 1.6} ${top + 6} ${x + 1.5} ${top + 10} ${x} ${top + 10}C${x - 1.5} ${top + 10} ${x - 1.6} ${top + 6} ${x} ${top + 4}Z`;
}
</script>

<template>
  <span
    class="card-art"
    :class="[`card-art-${surface}`, { 'card-art-rising': rising }]"
    :style="{ '--art-rise': `${rise}px`, '--art-size': `${size}px` }"
    aria-hidden="true"
  >
    <svg
      v-if="art.kind === 'moon'"
      class="art-moon"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath :id="`${id}-lit`">
          <path :d="moonLit" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" class="moon-dark" />
      <path :d="moonLit" class="moon-lit" />
      <g :clip-path="`url(#${id}-lit)`">
        <ellipse
          v-for="(mare, i) in MARIA"
          :key="i"
          :cx="mare.cx"
          :cy="mare.cy"
          :rx="mare.rx"
          :ry="mare.ry"
          :transform="`rotate(${mare.rot} ${mare.cx} ${mare.cy})`"
          class="moon-mare"
        />
        <circle
          v-for="(crater, i) in CRATERS"
          :key="`c${i}`"
          :cx="crater.cx"
          :cy="crater.cy"
          :r="crater.r"
          class="moon-crater"
        />
      </g>
    </svg>

    <svg v-else class="art-hanoukia" viewBox="0 0 100 135" xmlns="http://www.w3.org/2000/svg">
      <!-- Le pied et la tige, l'argent en deux tons : la face, et l'ombre. -->
      <path d="M34 135L40 126H60L66 135Z" class="metal" />
      <rect x="38" y="124" width="24" height="3" rx="1" class="metal-light" />
      <rect x="47" y="45" width="6" height="80" class="metal" />
      <rect x="51" y="45" width="2" height="80" class="metal-shade" />
      <rect x="45" y="83" width="10" height="5" rx="2" class="metal-light" />
      <!-- La barre et ses godets. -->
      <rect x="2" y="40" width="96" height="5" rx="1.5" class="metal" />
      <rect x="2" y="43.4" width="96" height="1.6" class="metal-shade" />
      <rect
        v-for="x in BRANCHES"
        :key="`g${x}`"
        :x="x - 3.5"
        y="36"
        width="7"
        height="4"
        class="metal-light"
      />
      <!-- Le chamach, sur sa colonne, plus haut que les autres. -->
      <rect x="48" y="30" width="4" height="10" class="metal" />
      <rect x="46" y="26" width="8" height="4" class="metal-light" />

      <!-- Les bougies du soir, et la sienne. -->
      <g>
        <rect :x="SHAMASH - 2.6" y="11" width="5.2" height="15" class="wax" />
        <rect :x="SHAMASH + 1.2" y="11" width="1.4" height="15" class="wax-shade" />
        <rect :x="SHAMASH - 0.4" y="9" width="0.8" height="2" class="wick" />
      </g>
      <g v-for="candle in candles" :key="`b${candle.x}`">
        <rect :x="candle.x - 2.3" y="17" width="4.6" height="19" class="wax" />
        <rect :x="candle.x + 1" y="17" width="1.3" height="19" class="wax-shade" />
        <rect :x="candle.x - 0.4" y="15" width="0.8" height="2" class="wick" />
      </g>

      <!-- Les flammes : le chamach d'abord, puis la bougie du soir, à gauche. -->
      <template v-if="lit">
        <g class="flame" style="--flame-order: 0">
          <path :d="flame(SHAMASH, -1)" class="flame-outer" />
          <path :d="flameCore(SHAMASH, -1)" class="flame-inner" />
        </g>
        <g
          v-for="candle in candles"
          :key="`f${candle.x}`"
          class="flame"
          :style="{ '--flame-order': candle.order }"
        >
          <path :d="flame(candle.x, 5)" class="flame-outer" />
          <path :d="flameCore(candle.x, 5)" class="flame-inner" />
        </g>
      </template>
    </svg>
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

  /* Les couleurs de l'objet, pas celles du thème : elles ne changent ni avec
     la fête ni avec le mode sombre. */
  --moon-lit: #f2eddf;
  --moon-mare: #dad1bb;
  --moon-crater: #fbf8ef;
  /* La part sombre : la lumière cendrée, un disque à peine plus clair que
     le fond, qui dit la lune entière sans la peindre. */
  --moon-dark: rgb(255 255 255 / 0.14);
  --metal: #d3d7dd;
  --metal-light: #eceef1;
  --metal-shade: #a9afb8;
  --wax: #f7f2e7;
  --wax-shade: #e0d6c1;
  --wick: #4a4038;
  --flame-outer: #f6a623;
  --flame-inner: #ffe48a;
}

/* Sur une surface claire, la lune prend un ton plus soutenu pour se détacher
   du blanc, et sa part sombre se fait plus légère. */
.card-art-plain {
  --moon-lit: #ebe4d0;
  --moon-mare: #cfc5ab;
  --moon-dark: rgb(15 20 40 / 0.07);
}
/* Une surface sombre (mode sombre) : la lumière cendrée redevient un voile
   clair, comme sur une carte en couleur. */
:global(:root.dark) .card-art-plain {
  --moon-dark: rgb(255 255 255 / 0.08);
}

svg {
  position: absolute;
  bottom: 0;
  inset-inline-end: 0;
  overflow: visible;
}

/* La lune a sa taille à elle (`size`), quelle que soit la hauteur de la
   carte : son bord haut dépasse du haut de la carte, d'autant que `rise`,
   et le reste du disque tient dedans. Elle ne mord pas sur le côté : une
   lune croissante s'éclaire par là, la couper la montrerait sombre. */
.art-moon {
  top: 0;
  bottom: auto;
  height: var(--art-size);
  aspect-ratio: 1;
  inset-inline-end: 0.5rem;
}

.art-hanoukia {
  height: 100%;
  aspect-ratio: 100 / 135;
  margin-inline-end: 0.75rem;
}

.moon-dark {
  fill: var(--moon-dark);
}
.moon-lit {
  fill: var(--moon-lit);
}
.moon-mare {
  fill: var(--moon-mare);
}
.moon-crater {
  fill: var(--moon-crater);
}
.metal {
  fill: var(--metal);
}
.metal-light {
  fill: var(--metal-light);
}
.metal-shade {
  fill: var(--metal-shade);
}
.wax {
  fill: var(--wax);
}
.wax-shade {
  fill: var(--wax-shade);
}
.wick {
  fill: var(--wick);
}
.flame-outer {
  fill: var(--flame-outer);
}
.flame-inner {
  fill: var(--flame-inner);
}

/* --- Le lever, une fois par session ------------------------------------- */
.card-art-rising .art-moon {
  animation: moon-rise 1.8s cubic-bezier(0.2, 0.7, 0.25, 1) both;
}
[dir="rtl"] .card-art-rising .art-moon {
  animation-name: moon-rise-rtl;
}
.card-art-rising .art-hanoukia {
  animation: hanoukia-rise 0.9s cubic-bezier(0.25, 0.8, 0.3, 1) both;
}
.card-art-rising .flame {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: flame-on 0.4s ease-out both;
  animation-delay: calc(1s + var(--flame-order) * 0.22s);
}

/* Elle part du coin bas, sous le bord de la carte, et monte en biais. */
@keyframes moon-rise {
  from {
    transform: translate(30%, 175%);
  }
  to {
    transform: none;
  }
}
@keyframes moon-rise-rtl {
  from {
    transform: translate(-30%, 175%);
  }
  to {
    transform: none;
  }
}
@keyframes hanoukia-rise {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
@keyframes flame-on {
  0% {
    opacity: 0;
    transform: scale(0.2);
  }
  60% {
    opacity: 1;
    transform: scale(1.15);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card-art-rising .art-moon,
  .card-art-rising .art-hanoukia,
  .card-art-rising .flame {
    animation: none;
  }
}
</style>
