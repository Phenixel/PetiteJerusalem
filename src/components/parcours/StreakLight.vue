<script setup lang="ts">
/**
 * La lumière de la série (services/parcours/lights.ts) : la vieille lampe de
 * terre cuite d'abord (ParcoursLamp), puis la bougie, la lanterne, la
 * ménorah, le phare, la lune, le soleil, les étoiles, la galaxie, la
 * supernova, le quasar et la lumière du premier jour.
 *
 * Des objets aux couleurs du vrai, en aplats, à la taille de la lampe (80
 * sur 62) : ils prennent sa place sans rien déplacer. Ce qui brûle a sa
 * flamme, qui monte une journée pleine et baisse un jour manqué ; ce qui
 * rayonne a son halo, plus ou moins vif.
 *
 * Elles vivent doucement, comme une vraie lumière : la flamme vacille, le
 * halo respire, les étoiles scintillent, les rayons du soleil et de l'aube
 * tournent lentement, le phare balaie, les bras de la galaxie tournent, la
 * coque de la supernova s'éloigne, les jets du quasar tournent en pulsant. C'est l'exception admise
 * à « Le mouvement répond à un geste » (docs/design.md) ; elle se coupe en
 * mouvement réduit et en rendu allégé (`perf-lite`), où la lumière reste
 * posée, entière.
 *
 * `locked` : une lumière encore à gagner, réduite à une ombre floue, et
 * immobile. On sait qu'il y a quelque chose, pas quoi.
 */
import { computed } from "vue";
import type { LightId } from "../../services/parcours/lights";
import ParcoursLamp, { type LampLevel } from "./ParcoursLamp.vue";

const props = withDefaults(
  defineProps<{ light: LightId; level?: LampLevel; width?: number; locked?: boolean }>(),
  { level: "normal", width: 76, locked: false },
);

/** La flamme : basse un jour manqué, haute une journée pleine (comme la lampe). */
const FLAME: Record<LampLevel, number> = { low: 0.7, normal: 1, high: 1.15 };
/** Le halo de ce qui rayonne : plus pâle un jour manqué, plus vif une journée pleine. */
const GLOW: Record<LampLevel, number> = { low: 0.12, normal: 0.22, high: 0.34 };

const vars = computed(() => ({
  "--flame": String(FLAME[props.level]),
  "--glow": String(GLOW[props.level]),
}));

/** Une étoile à quatre branches, aux flancs creusés. */
function sparkle(x: number, y: number, r: number, k = 0.22): string {
  const c = r * k;
  return (
    `M${x} ${y - r}Q${x + c} ${y - c} ${x + r} ${y}Q${x + c} ${y + c} ${x} ${y + r}` +
    `Q${x - c} ${y + c} ${x - r} ${y}Q${x - c} ${y - c} ${x} ${y - r}Z`
  );
}

/** Une étoile à `n` pointes, de rayons `outer` et `inner`, autour de (40, 30). */
function burst(n: number, outer: number, inner: number, turn = 0): string {
  const points: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const angle = turn + (Math.PI * i) / n;
    const r = i % 2 === 0 ? outer : inner;
    points.push(
      `${(40 + r * Math.sin(angle)).toFixed(2)} ${(30 - r * Math.cos(angle)).toFixed(2)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

/**
 * Un bras de la galaxie : une spirale tracée dans le plan de son disque,
 * autour de (0, 0). Le dessin la couche et l'incline (vue de biais), pour
 * qu'elle puisse tourner dans ce plan, comme une vraie galaxie.
 */
function arm(offset: number): string {
  const points: string[] = [];
  for (let i = 0; i <= 44; i++) {
    const theta = 0.35 + (i / 44) * 3 * Math.PI;
    const r = 2.4 + 3 * theta;
    const x = r * Math.cos(theta + offset);
    const y = r * Math.sin(theta + offset);
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M${points.join("L")}`;
}

const MENORAH_CUPS = [19, 26, 33, 40, 47, 54, 61];
const MENORAH_ARMS = [7, 14, 21];
/** Une petite flamme posée en (x, 11.6). */
const smallFlame = (x: number) =>
  `M${x} 3C${x + 2} 6 ${x + 2.8} 7.6 ${x + 2.8} 8.8A2.8 2.8 0 0 1 ${x - 2.8} 8.8C${x - 2.8} 7.6 ${x - 2} 6 ${x} 3Z`;

const SUN_RAYS = Array.from({ length: 12 }, (_, i) => i * 30);
const DAWN_RAYS = Array.from({ length: 24 }, (_, i) => i * 15);
const GALAXY_ARMS = [arm(0), arm(Math.PI)];
const GALAXY_DUST: [number, number, number][] = [
  [12, 22, 0.9],
  [20, 46, 1.1],
  [64, 14, 1],
  [70, 40, 0.8],
  [54, 50, 1.2],
  [28, 12, 0.7],
];
const STARS = {
  big: sparkle(40, 29, 14),
  others: [sparkle(18, 15, 6.5), sparkle(63, 13, 7.5), sparkle(15, 43, 4.5), sparkle(64, 43, 5.5)],
  tiny: [
    [50, 52, 1.4],
    [28, 53, 1.1],
    [74, 27, 1.2],
    [6, 29, 1],
    [36, 6, 1],
  ] as [number, number, number][],
};
const NOVA = {
  outer: burst(16, 23, 10),
  inner: burst(8, 14, 7, Math.PI / 16),
  sparks: Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI * (2 * i + 1)) / 8;
    const r = i % 2 === 0 ? 27 : 25;
    return [40 + r * Math.sin(angle), 30 - r * Math.cos(angle)];
  }),
};
</script>

<template>
  <ParcoursLamp
    v-if="light === 'lamp'"
    :level="level"
    :width="width"
    class="streak-light"
    :class="{ 'is-locked': locked }"
  />
  <svg
    v-else
    :width="width"
    :height="(width * 62) / 80"
    viewBox="0 0 80 62"
    aria-hidden="true"
    class="streak-light"
    :class="{ 'is-locked': locked }"
    :style="vars"
  >
    <!-- La bougie, dans son bougeoir de laiton. -->
    <template v-if="light === 'candle'">
      <ellipse cx="40" cy="57" rx="19" ry="2.6" class="shadow" />
      <circle cx="60" cy="50" r="4" fill="none" stroke="#b8862f" stroke-width="2.2" />
      <ellipse cx="40" cy="52.5" rx="17" ry="4" fill="#b8862f" />
      <ellipse cx="40" cy="51" rx="17" ry="3.4" fill="#d9a948" />
      <rect x="34" y="22" width="12" height="29" rx="1.5" fill="#f4ead2" />
      <rect x="42.5" y="22" width="3.5" height="29" fill="#e3d5b3" />
      <ellipse cx="40" cy="22" rx="6" ry="1.6" fill="#fbf5e6" />
      <path d="M34.6 22.6v7a1.6 1.6 0 0 0 3.2 0v-6.4Z" fill="#fbf5e6" />
      <g class="flame" style="transform-origin: 40px 21px">
        <path
          d="M40 2C44 8.5 46.5 12 46.5 15A6.5 6.5 0 0 1 33.5 15C33.5 12 36 8.5 40 2Z"
          fill="#f2a541"
        />
        <path
          d="M40 9C41.8 12 43 13.6 43 15.5A3 3 0 0 1 37 15.5C37 13.6 38.2 12 40 9Z"
          fill="#fde6b0"
        />
      </g>
      <rect x="39.4" y="17.5" width="1.2" height="5" rx="0.6" fill="#3b2412" />
    </template>

    <!-- La lanterne : son anse, son toit, sa vitre allumée, sa flamme. -->
    <g v-else-if="light === 'lantern'" transform="translate(0 3)">
      <ellipse cx="40" cy="54" rx="17" ry="2.6" class="shadow" />
      <path d="M33 8A7 7 0 0 1 47 8" fill="none" stroke="#4a3a2c" stroke-width="2.2" />
      <path d="M30 15L50 15L45 8L35 8Z" fill="#5b4636" />
      <rect x="28" y="14" width="24" height="3" rx="1.5" fill="#4a3a2c" />
      <rect x="30" y="17" width="20" height="27" fill="#fbe3a6" />
      <ellipse cx="40" cy="32" rx="8" ry="11" class="glow" fill="#f2a541" />
      <g class="flame" style="transform-origin: 40px 37px">
        <path d="M40 22C43 27 45 30 45 32.5A5 5 0 0 1 35 32.5C35 30 37 27 40 22Z" fill="#f2a541" />
        <path
          d="M40 27C41.5 29.3 42.5 31 42.5 32.7A2.5 2.5 0 0 1 37.5 32.7C37.5 31 38.5 29.3 40 27Z"
          fill="#fffaf0"
        />
      </g>
      <rect x="39.4" y="36.5" width="1.2" height="3.5" fill="#3b2412" />
      <rect x="37" y="40" width="6" height="4" fill="#f4ead2" />
      <rect x="29" y="17" width="2.4" height="27" fill="#4a3a2c" />
      <rect x="48.6" y="17" width="2.4" height="27" fill="#4a3a2c" />
      <rect x="27" y="44" width="26" height="4" rx="1.5" fill="#4a3a2c" />
      <rect x="29" y="48" width="4" height="3" fill="#3e3025" />
      <rect x="47" y="48" width="4" height="3" fill="#3e3025" />
    </g>

    <!-- La ménorah du Temple : sept branches, sept flammes. -->
    <template v-else-if="light === 'menorah'">
      <ellipse cx="40" cy="57" rx="20" ry="2.6" class="shadow" />
      <path
        v-for="r in MENORAH_ARMS"
        :key="r"
        :d="`M${40 - r} 14A${r} ${r} 0 0 0 ${40 + r} 14`"
        fill="none"
        stroke="#c99a3e"
        stroke-width="2.4"
      />
      <rect x="38.8" y="13" width="2.4" height="35" fill="#c99a3e" />
      <rect x="34" y="47" width="12" height="4.5" rx="1" fill="#c99a3e" />
      <rect x="30" y="51" width="20" height="4.5" rx="1" fill="#b5852f" />
      <rect
        v-for="x in MENORAH_CUPS"
        :key="`cup-${x}`"
        :x="x - 2.4"
        y="11"
        width="4.8"
        height="3.4"
        rx="1"
        fill="#b5852f"
      />
      <g
        v-for="(x, i) in MENORAH_CUPS"
        :key="`flame-${x}`"
        class="flame"
        :style="{ transformOrigin: `${x}px 11.6px`, animationDelay: `${-0.37 * i}s` }"
      >
        <path :d="smallFlame(x)" fill="#f2a541" />
        <ellipse :cx="x" cy="9.2" rx="1.2" ry="1.6" fill="#fde6b0" />
      </g>
    </template>

    <!-- Le phare sur son rocher, et ses deux faisceaux. -->
    <template v-else-if="light === 'lighthouse'">
      <path d="M40 16L3 8L3 24Z" class="glow beam" fill="#f2a541" />
      <path d="M40 16L77 8L77 24Z" class="glow beam beam-late" fill="#f2a541" />
      <path d="M17 57C19 51 25 48.5 32 49L50 49C57 48.5 62 51.5 64 57Z" fill="#8c8273" />
      <path d="M30 49L34 22L46 22L50 49Z" fill="#f4ead2" />
      <path d="M30.59 45L31.33 40L48.67 40L49.41 45Z" fill="#c0533a" />
      <path d="M32.07 35L32.81 30L47.19 30L47.93 35Z" fill="#c0533a" />
      <path d="M38 49v-2.6a2 2 0 0 1 4 0V49Z" fill="#6b5a49" />
      <rect x="32" y="20" width="16" height="2.6" rx="1" fill="#4a3a2c" />
      <rect x="35" y="12" width="10" height="8" fill="#fbe3a6" />
      <rect x="35" y="12" width="1.4" height="8" fill="#4a3a2c" />
      <rect x="43.6" y="12" width="1.4" height="8" fill="#4a3a2c" />
      <path d="M33.5 12.5L40 6L46.5 12.5Z" fill="#c0533a" />
      <circle cx="40" cy="5.6" r="1.3" fill="#4a3a2c" />
    </template>

    <!-- La lune : un croissant doré, ses taches, trois étoiles. -->
    <template v-else-if="light === 'moon'">
      <circle cx="40" cy="31" r="25" class="glow" fill="#f3d27a" />
      <path d="M37.83 13.13A18 18 0 1 0 57.33 35.88A15 15 0 0 1 37.83 13.13Z" fill="#e9c46a" />
      <circle cx="30" cy="33" r="2.4" fill="#d6ad4c" />
      <circle cx="35" cy="43" r="1.6" fill="#d6ad4c" />
      <path :d="sparkle(64, 11, 3.6)" class="twinkle" fill="#e9c46a" />
      <path
        :d="sparkle(71, 25, 2.4)"
        class="twinkle"
        style="animation-delay: -1.1s"
        fill="#e9c46a"
      />
      <path
        :d="sparkle(14, 12, 2.6)"
        class="twinkle"
        style="animation-delay: -2.3s"
        fill="#e9c46a"
      />
    </template>

    <!-- Le soleil : son disque et ses douze rayons. -->
    <template v-else-if="light === 'sun'">
      <circle cx="40" cy="30" r="29" class="glow" fill="#f8cf73" />
      <g class="turn" style="transform-origin: 40px 30px">
        <path
          v-for="angle in SUN_RAYS"
          :key="angle"
          :d="angle % 60 === 0 ? 'M37.4 13L40 2.5L42.6 13Z' : 'M38 13L40 6L42 13Z'"
          :transform="`rotate(${angle} 40 30)`"
          fill="#f2a541"
        />
      </g>
      <circle cx="40" cy="30" r="15" fill="#f6b93b" />
      <circle cx="40" cy="30" r="10.5" fill="#f9cf62" />
    </template>

    <!-- Les étoiles : une grande, et le ciel autour. -->
    <template v-else-if="light === 'stars'">
      <circle cx="40" cy="29" r="15" class="glow" fill="#f3d27a" />
      <path :d="STARS.big" class="twinkle twinkle-soft" fill="#f2c14e" />
      <path
        v-for="(d, i) in STARS.others"
        :key="i"
        :d="d"
        class="twinkle"
        :style="{ animationDelay: `${-0.8 * (i + 1)}s` }"
        fill="#e9c46a"
      />
      <circle
        v-for="([x, y, r], i) in STARS.tiny"
        :key="`tiny-${i}`"
        :cx="x"
        :cy="y"
        :r="r"
        class="twinkle"
        :style="{ animationDelay: `${-0.55 * i - 0.3}s` }"
        fill="#d8b25a"
      />
    </template>

    <!-- La galaxie : deux bras en spirale, vus de biais, et sa poussière. -->
    <template v-else-if="light === 'galaxy'">
      <ellipse
        cx="40"
        cy="31"
        rx="36"
        ry="17"
        transform="rotate(-15 40 31)"
        class="glow"
        fill="#b9a8f0"
      />
      <!-- Le disque vu de biais : couché de moitié, incliné de 15 degrés. Les
           bras y tournent, leurs pointes en arrière. -->
      <g transform="translate(40 31) rotate(-15) scale(1 0.5)">
        <g class="arms">
          <path
            v-for="(d, i) in GALAXY_ARMS"
            :key="`wide-${i}`"
            :d="d"
            fill="none"
            stroke="#c9bdf5"
            stroke-width="7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            v-for="(d, i) in GALAXY_ARMS"
            :key="`thin-${i}`"
            :d="d"
            fill="none"
            stroke="#7e6cd6"
            stroke-width="2.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>
      </g>
      <g>
        <ellipse cx="40" cy="31" rx="7.5" ry="5" transform="rotate(-15 40 31)" fill="#ffe39a" />
        <ellipse cx="40" cy="31" rx="4" ry="2.6" transform="rotate(-15 40 31)" fill="#fffaf0" />
        <circle
          v-for="([x, y, r], i) in GALAXY_DUST"
          :key="`dust-${i}`"
          :cx="x"
          :cy="y"
          :r="r"
          class="twinkle"
          :style="{ animationDelay: `${-0.6 * i}s` }"
          fill="#9d8fe0"
        />
      </g>
    </template>

    <!-- La supernova : l'éclat, sa coque qui s'éloigne, ses éclats. -->
    <template v-else-if="light === 'supernova'">
      <circle
        cx="40"
        cy="30"
        r="27.5"
        fill="none"
        stroke="#e8794a"
        stroke-width="2"
        stroke-dasharray="3 4"
        class="glow-strong turn"
        style="transform-origin: 40px 30px"
      />
      <circle cx="40" cy="30" r="24" class="glow" fill="#f6b26b" />
      <path :d="NOVA.outer" class="pulse" style="transform-origin: 40px 30px" fill="#ef8a45" />
      <path :d="NOVA.inner" fill="#f8c55a" />
      <circle cx="40" cy="30" r="5" fill="#fffaf0" />
      <circle v-for="([x, y], i) in NOVA.sparks" :key="i" :cx="x" :cy="y" r="1.3" fill="#e8794a" />
    </template>

    <!-- Le quasar : son disque, ses deux jets qui tournent autour du cœur. -->
    <template v-else-if="light === 'quasar'">
      <g transform="rotate(-12 40 31)">
        <g class="turn turn-jets" style="transform-origin: 40px 31px">
          <g class="jet">
            <path d="M40 31L37.4 1.5L42.6 1.5Z" fill="#7fb3ef" />
            <path d="M40 31L37.4 60.5L42.6 60.5Z" fill="#7fb3ef" />
            <path d="M40 31L39.3 5L40.7 5Z" fill="#dbeafe" />
            <path d="M40 31L39.3 57L40.7 57Z" fill="#dbeafe" />
          </g>
        </g>
        <circle cx="40" cy="31" r="13" class="glow" fill="#bcd7f7" />
        <ellipse cx="40" cy="31" rx="28" ry="6.5" fill="#e07b39" />
        <ellipse cx="40" cy="31" rx="20" ry="4.6" fill="#f2a541" />
        <ellipse cx="40" cy="31" rx="11" ry="2.6" fill="#fde6b0" />
      </g>
      <circle cx="40" cy="31" r="4.4" fill="#ffffff" stroke="#fde6b0" stroke-width="2" />
    </template>

    <!-- La lumière du premier jour : un éclat blanc et or, sans objet. -->
    <template v-else-if="light === 'first-light'">
      <circle cx="40" cy="30" r="30" class="glow" fill="#f6d77b" />
      <circle cx="40" cy="30" r="21" class="glow" fill="#f6d77b" />
      <g class="turn turn-slow" style="transform-origin: 40px 30px">
        <line
          v-for="angle in DAWN_RAYS"
          :key="angle"
          x1="40"
          :y1="18"
          x2="40"
          :y2="angle % 30 === 0 ? 1.5 : 9"
          :transform="`rotate(${angle} 40 30)`"
          stroke="#e9b949"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </g>
      <circle cx="40" cy="30" r="10" fill="#fff6dc" stroke="#e9b949" stroke-width="1.6" />
      <circle cx="40" cy="30" r="5.5" fill="#ffffff" />
    </template>
  </svg>
</template>

<style scoped>
.shadow {
  fill: rgb(58 46 30 / 0.16);
}
:root.dark .shadow {
  fill: rgb(0 0 0 / 0.3);
}
/* La flamme grandit ou baisse depuis sa mèche, et vacille : le vacillement
   passe par `scale` et `rotate`, qui s'ajoutent au `transform` du niveau. */
.flame {
  transform: scale(var(--flame, 1));
  transform-box: view-box;
  transition: transform 0.4s ease;
  animation: flame-flicker 2.6s ease-in-out infinite;
}
/* Le halo respire. */
.glow {
  opacity: var(--glow, 0.22);
  animation: glow-breathe 3.6s ease-in-out infinite;
}
.glow-strong {
  opacity: calc(var(--glow, 0.22) * 3);
}
/* Le phare balaie : un faisceau puis l'autre. */
.beam {
  animation: beam-sweep 4s ease-in-out infinite;
}
.beam-late {
  animation-delay: -2s;
}
/* Les étoiles scintillent, chacune à son heure. */
.twinkle {
  transform-box: fill-box;
  transform-origin: center;
  animation: star-twinkle 2.8s ease-in-out infinite;
}
.twinkle-soft {
  animation-name: star-twinkle-soft;
  animation-duration: 3.4s;
}
/* Les rayons tournent lentement. */
.turn {
  transform-box: view-box;
  animation: light-turn 40s linear infinite;
}
.turn-slow {
  animation-duration: 90s;
}
.turn-jets {
  animation-duration: 16s;
}
/* Les bras de la galaxie tournent dans leur disque, pointes en arrière. */
.arms {
  transform-box: view-box;
  transform-origin: 0 0;
  animation: arms-turn 24s linear infinite;
}
/* L'éclat de la supernova bat. */
.pulse {
  transform-box: view-box;
  animation: nova-pulse 2.4s ease-in-out infinite;
}
/* Les jets du quasar pulsent. */
.jet {
  animation: jet-pulse 1.8s ease-in-out infinite;
}
@keyframes flame-flicker {
  0%,
  100% {
    scale: 1;
    rotate: 0deg;
  }
  20% {
    scale: 0.96 1.05;
    rotate: -2deg;
  }
  45% {
    scale: 1.03 0.96;
    rotate: 1.5deg;
  }
  70% {
    scale: 0.98 1.03;
    rotate: -1deg;
  }
}
@keyframes glow-breathe {
  50% {
    opacity: calc(var(--glow, 0.22) * 1.6);
  }
}
@keyframes beam-sweep {
  0%,
  100% {
    opacity: calc(var(--glow, 0.22) * 0.5);
  }
  50% {
    opacity: calc(var(--glow, 0.22) * 2.4);
  }
}
@keyframes star-twinkle {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.7);
    opacity: 0.55;
  }
}
@keyframes star-twinkle-soft {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.9) rotate(8deg);
  }
}
@keyframes light-turn {
  to {
    transform: rotate(360deg);
  }
}
@keyframes arms-turn {
  to {
    transform: rotate(-360deg);
  }
}
@keyframes nova-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}
@keyframes jet-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
/* Encore à gagner : une ombre floue, sans couleur ni détail. */
.streak-light.is-locked {
  filter: brightness(0) blur(3.5px);
  opacity: 0.16;
}
:root.dark .streak-light.is-locked {
  filter: brightness(0) invert(1) blur(3.5px);
  opacity: 0.2;
}
/* Une lumière à gagner reste immobile ; tout se fige en mouvement réduit et
   en rendu allégé, sur l'état posé. */
.streak-light.is-locked *,
:root.perf-lite .streak-light * {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .streak-light * {
    animation: none;
  }
  .flame {
    transition: none;
  }
}
</style>
