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

<!-- Les pierres elles-mêmes : partagées (voir stones.css). -->
<style src="./stones.css"></style>
