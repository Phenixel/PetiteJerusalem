<script setup lang="ts">
/**
 * Le mur : une pierre par jour, une colonne par semaine, du dimanche (en
 * haut) au Chabbat (en bas, la rangée plus haute). On le construit jour après
 * jour ; on le regarde pour voir ce qu'on a bâti.
 *
 * Les pierres sont celles de Jérusalem, taillées à la main (voir
 * docs/design.md, « Le mur se bâtit en pierres, et seulement lui ») : le
 * bouton est la place de la pierre, rempli de ciment ; la pierre a un contour
 * brisé, une marge lisse et un bossage au grain minéral qui prend la lumière
 * en haut. Rien de fait : un creux. En partie : une pierre à moitié posée.
 * Chabbat, une fête ou rien de prévu : une pierre blanche. À venir : la place
 * en pointillé, sans ciment.
 *
 * Deux tenues. `compact` (Mon parcours) : les colonnes se partagent la
 * largeur, et une rangée sur deux glisse d'une demi-pierre vers le passé ;
 * les demi-pierres coupées à gauche disent que le mur continue. `full` (le
 * mur entier) : des colonnes étroites, que la page fait défiler.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { localDayFrom } from "../../services/dateService";
import { dateTimeFormat } from "../../services/intlCache";
import type { DayKey } from "../../services/parcours/model";
import type { DayStatus, DaySummary, WallWeek } from "../../services/parcours/schedule";

const props = withDefaults(
  defineProps<{
    weeks: WallWeek[];
    variant?: "compact" | "full";
    selected?: DayKey | null;
  }>(),
  { variant: "compact", selected: null },
);

const emit = defineEmits<{ (e: "pick", day: DayKey): void }>();

const { t, locale } = useI18n();

/**
 * Le sens du mur est celui de la langue, posé sur le mur lui-même : la page
 * qui le fait défiler peut prendre le sens contraire (MurPage).
 */
const dir = computed(() => (locale.value === "he" ? "rtl" : "ltr"));

const STATUS_CLASS: Record<DayStatus, string> = {
  full: "is-full",
  partial: "is-partial",
  rest: "is-rest",
  none: "is-none",
  today: "is-today",
  future: "is-future",
  before: "is-before",
};

/** Un dessin de pierre et une teinte, tirés du jour : le mur ne bouge pas d'une visite à l'autre. */
function look(day: DayKey): string {
  const n = Number(day.replace(/-/g, ""));
  return `v${(n * 7) % 6} c${(n * 3) % 4}`;
}

function stoneClass(summary: DaySummary): string[] {
  const classes = [STATUS_CLASS[summary.status], look(summary.day)];
  if (summary.day === props.selected) classes.push("is-selected");
  return classes;
}

const touchable = (summary: DaySummary): boolean =>
  summary.status !== "future" && summary.status !== "before";

function ariaOf(summary: DaySummary): string {
  const date = localDayFrom(summary.day) ?? new Date();
  const label = dateTimeFormat(locale.value, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return `${label}, ${t(`parcours.wall.status.${summary.status}`)}`;
}
</script>

<template>
  <div class="pj-stone-wall" :class="`pj-stone-wall-${variant}`" :dir="dir" role="group">
    <div v-for="(week, index) in weeks" :key="week.week" class="wall-col">
      <slot name="label" :week="week" :index="index" />
      <button
        v-for="summary in week.days"
        :key="summary.day"
        type="button"
        class="pj-stone"
        :class="stoneClass(summary)"
        :disabled="!touchable(summary)"
        :aria-label="ariaOf(summary)"
        :aria-pressed="summary.day === selected"
        @click="emit('pick', summary.day)"
      />
      <slot name="footer" :week="week" :index="index" />
    </div>
  </div>
</template>

<style scoped>
.pj-stone-wall {
  display: flex;
}
.wall-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pj-stone-wall-compact {
  /* Le mur continue vers le passé : ce qui dépasse à gauche est coupé. */
  clip-path: inset(-6px -6px -60px 0);
}
.pj-stone-wall-compact .wall-col {
  flex: 1;
}
.pj-stone-wall-compact .pj-stone {
  width: 100%;
  height: 30px;
  --bevel: 4px;
}
.pj-stone-wall-compact .pj-stone:nth-of-type(2n) {
  transform: translateX(-50%);
}
/* En hébreu, le passé est à droite : le mur se lit dans l'autre sens. */
.pj-stone-wall-compact[dir="rtl"] {
  clip-path: inset(-6px 0 -60px -6px);
}
.pj-stone-wall-compact[dir="rtl"] .pj-stone:nth-of-type(2n) {
  transform: translateX(50%);
}
.pj-stone-wall-full[dir="rtl"] .pj-stone:nth-of-type(2n) {
  transform: translateX(-50%);
}
.pj-stone-wall-full .wall-col {
  width: 25px;
  flex: none;
}
.pj-stone-wall-full .pj-stone {
  width: 25px;
  height: 30px;
}
.pj-stone-wall-full .pj-stone:nth-of-type(2n) {
  transform: translateX(50%);
}
/* Chabbat, en bas : la rangée plus haute, comme une assise de fondation. */
.pj-stone-wall .pj-stone:nth-of-type(7) {
  height: 37px;
}
</style>

<!-- Les pierres elles-mêmes : partagées avec la légende du mur (StoneLegend). -->
<style>
/* Les pierres --------------------------------------------------------
   Des aplats et un grain minéral (une texture SVG, pas un dégradé). Les
   couleurs sont celles de la pierre, hors thème, comme les reliures. */
.pj-stone {
  --mortar: #bcad95;
  --face: #dfc796;
  --boss: #e8d5ad;
  --joint: 1.5px;
  --bevel: 3px;
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .36 0 0 0 0 .25 0 0 0 0 .1 1.15 0 0 0 -.52'/%3E%3C/filter%3E%3Crect width='60' height='60' filter='url%28%23g%29'/%3E%3C/svg%3E");
  position: relative;
  display: block;
  border: 0;
  padding: 0;
  cursor: pointer;
  isolation: isolate;
  background: var(--mortar);
  box-shadow: 0 0 0 0.5px var(--mortar);
  border-radius: 1px;
}
.dark .pj-stone {
  --mortar: #5d5446;
}
.pj-stone::before,
.pj-stone::after {
  content: "";
  position: absolute;
  z-index: -1;
  pointer-events: none;
}
/* La pierre, au contour brisé ; la lumière en haut, l'ombre en bas. */
.pj-stone::before {
  inset: var(--joint);
  background: var(--face);
  box-shadow:
    inset 0 1.5px 0 rgb(255 248 228 / 0.55),
    inset 0 -2px 0 rgb(112 76 28 / 0.3);
  clip-path: polygon(
    3% 0%,
    50% 0%,
    99% 2%,
    98% 40%,
    96% 65%,
    97% 96%,
    66% 98%,
    32% 98%,
    1% 99%,
    0% 74%,
    3% 35%
  );
}
/* Le bossage : plus clair, au grain, rentré de la marge ciselée. */
.pj-stone::after {
  inset: calc(var(--joint) + var(--bevel));
  background: var(--grain) var(--boss);
  box-shadow:
    inset 0 1px 0 rgb(255 251 238 / 0.6),
    inset 0 -1px 0 rgb(140 100 45 / 0.22);
  clip-path: polygon(9% 10%, 46% 13%, 94% 3%, 98% 26%, 88% 59%, 90% 91%, 42% 85%, 2% 88%, 9% 43%);
}
.pj-stone.v1::before {
  clip-path: polygon(3% 1%, 46% 2%, 96% 4%, 95% 44%, 97% 98%, 66% 96%, 37% 97%, 5% 96%, 5% 53%);
}
.pj-stone.v1::after {
  clip-path: polygon(8% 5%, 44% 1%, 94% 6%, 95% 48%, 92% 99%, 47% 99%, 7% 88%, 1% 57%, 11% 26%);
}
.pj-stone.v2::before {
  clip-path: polygon(
    5% 1%,
    48% 3%,
    85% 3%,
    99% 18%,
    99% 39%,
    98% 67%,
    95% 98%,
    71% 100%,
    30% 97%,
    0% 97%,
    0% 60%,
    2% 38%
  );
}
.pj-stone.v2::after {
  clip-path: polygon(
    8% 0%,
    41% 7%,
    62% 2%,
    100% 2%,
    98% 48%,
    97% 96%,
    44% 93%,
    3% 95%,
    5% 63%,
    1% 34%
  );
}
.pj-stone.v3::before {
  clip-path: polygon(
    3% 2%,
    45% 4%,
    98% 5%,
    97% 54%,
    97% 98%,
    59% 99%,
    27% 97%,
    4% 100%,
    5% 70%,
    1% 40%
  );
}
.pj-stone.v3::after {
  clip-path: polygon(
    6% 7%,
    36% 8%,
    66% 1%,
    96% 4%,
    100% 38%,
    100% 61%,
    99% 98%,
    57% 97%,
    8% 98%,
    6% 55%
  );
}
.pj-stone.v4::before {
  clip-path: polygon(
    4% 3%,
    52% 1%,
    96% 3%,
    96% 45%,
    99% 94%,
    64% 94%,
    30% 94%,
    3% 95%,
    5% 68%,
    5% 39%
  );
}
.pj-stone.v4::after {
  clip-path: polygon(
    2% 12%,
    50% 1%,
    98% 2%,
    97% 36%,
    98% 56%,
    95% 94%,
    46% 98%,
    6% 94%,
    6% 71%,
    4% 42%
  );
}
.pj-stone.v5::before {
  clip-path: polygon(
    2% 2%,
    29% 4%,
    66% 3%,
    98% 4%,
    95% 51%,
    96% 76%,
    76% 96%,
    54% 95%,
    3% 99%,
    1% 52%
  );
}
.pj-stone.v5::after {
  clip-path: polygon(9% 5%, 55% 0%, 93% 1%, 89% 53%, 94% 97%, 53% 97%, 12% 98%, 6% 71%, 12% 43%);
}
.pj-stone.c1 {
  --face: #e6d2a9;
  --boss: #eedfc0;
}
.pj-stone.c2 {
  --face: #d9c39c;
  --boss: #e3d1b0;
}
.pj-stone.c3 {
  --face: #e0c8a8;
  --boss: #e9d7bd;
}

/* En partie : une pierre à moitié posée dans son creux. */
.pj-stone.is-partial::before {
  background: #a8977b;
  box-shadow: inset 0 3px 0 rgb(60 40 12 / 0.28);
}
.pj-stone.is-partial::after {
  inset: 50% var(--joint) var(--joint);
  box-shadow:
    inset 0 1.5px 0 rgb(255 251 238 / 0.7),
    inset 0 -2px 0 rgb(112 76 28 / 0.3);
}
/* Chabbat, une fête, rien de prévu : la pierre blanche, au grain plus léger. */
.pj-stone.is-rest {
  --face: #ede6d8;
  --boss: #f7f2e9;
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='5' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .36 0 0 0 0 .25 0 0 0 0 .1 0.7 0 0 0 -.33'/%3E%3C/filter%3E%3Crect width='60' height='60' filter='url%28%23g%29'/%3E%3C/svg%3E");
}
/* Rien de coché : un creux, l'ombre de la pierre du dessus. */
.pj-stone.is-none::before {
  background: #a8977b;
  box-shadow:
    inset 0 4px 0 rgb(60 40 12 / 0.3),
    inset 3px 0 0 rgb(60 40 12 / 0.12);
}
.dark .pj-stone.is-none::before,
.dark .pj-stone.is-partial::before {
  background: #3b342b;
}
.pj-stone.is-none::after,
.pj-stone.is-today::after,
.pj-stone.is-future::before,
.pj-stone.is-future::after,
.pj-stone.is-before::before,
.pj-stone.is-before::after {
  display: none;
}
/* Aujourd'hui : la place de la pierre qu'on pose, cernée de la couleur du thème. */
.pj-stone.is-today::before {
  background: #f1e6cf;
  box-shadow: inset 0 0 0 2px var(--color-primary);
  clip-path: none;
  border-radius: 1px;
}
.pj-stone.is-future,
.pj-stone.is-before {
  background: transparent;
  box-shadow: none;
  outline: 1px dashed rgb(53 49 42 / 0.3);
  outline-offset: -2px;
  cursor: default;
}
.pj-stone.is-before {
  outline-color: rgb(53 49 42 / 0.16);
}
.dark .pj-stone.is-future,
.dark .pj-stone.is-before {
  outline-color: rgb(255 255 255 / 0.28);
}
.pj-stone.is-selected {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 1px;
  z-index: 1;
}
.pj-stone:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  z-index: 1;
}
</style>
