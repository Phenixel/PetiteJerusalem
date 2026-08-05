<script setup lang="ts">
// Entrée et sortie du Chabbat, avec la paracha qu'on y lit.
//
// Composant à part parce que sa place dans la page change : le vendredi il
// passe devant les horaires du jour, c'est ce qu'on vient chercher. Le sortir
// ici évite d'écrire deux fois le même bloc pour deux positions.
//
// Même mise en page que les groupes d'horaires : un titre qui fait office de
// séparateur, puis les lignes. Aucun cadre — la page se lit d'un trait.
import { useI18n } from "vue-i18n";
import { hubPath } from "../../content/etudeTexts";
import type { WeeklyParasha } from "../../services/dailyCycles";
import { formatZmanDay, formatZmanTime, type ShabbatTimes } from "../../services/zmanimService";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{
  times: ShabbatTimes;
  /** La paracha de ce Chabbat — absente les semaines de fête. */
  parasha: WeeklyParasha | null;
  /** Fuseau du lieu : les heures s'affichent dedans, pas dans celui du navigateur. */
  tzid: string;
}>();

const { t, locale } = useI18n();

const clock = (date: Date) => formatZmanTime(date, props.tzid, locale.value);
const dayOf = (date: Date) => formatZmanDay(date, props.tzid, locale.value);
</script>

<template>
  <section>
    <!-- Le titre sépare, la règle du dessus tient lieu de bordure. Il porte le
         nom de la paracha : c'est l'identité de ce Chabbat-là. -->
    <h2
      class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-line pt-4 pb-1 text-sm font-bold uppercase tracking-wide text-text-secondary"
    >
      <span class="flex items-center gap-2">
        <AppIcon name="candle" :size="15" class="text-primary" />
        {{ t("zmanim.shabbat.title") }}
      </span>
      <span
        v-if="parasha"
        class="flex flex-wrap items-baseline gap-x-1.5 normal-case tracking-normal"
      >
        <span class="font-normal">{{ t("zmanim.shabbat.parasha") }}</span>
        <template v-for="(entry, index) in parasha.entries" :key="entry.id">
          <span v-if="index > 0" class="font-normal">·</span>
          <RouterLink :to="hubPath(entry)" class="font-semibold text-primary hover:underline">
            {{ entry.name }}
          </RouterLink>
        </template>
      </span>
    </h2>

    <ul class="flex flex-col divide-y divide-line">
      <li class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium text-text-primary leading-snug">
            {{ t("zmanim.shabbat.candleLighting") }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(times.candleLighting) }}</span>
        </span>
        <span class="shrink-0 font-semibold text-text-primary tabular-nums">
          {{ clock(times.candleLighting) }}
        </span>
      </li>
      <li class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium text-text-primary leading-snug">
            {{ t("zmanim.shabbat.havdalah") }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(times.havdalah) }}</span>
        </span>
        <span class="shrink-0 font-semibold text-text-primary tabular-nums">
          {{ clock(times.havdalah) }}
        </span>
      </li>
    </ul>

    <p class="mt-2 text-xs text-text-secondary">{{ t("zmanim.shabbat.note") }}</p>
  </section>
</template>
