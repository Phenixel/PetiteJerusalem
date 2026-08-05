<script setup lang="ts">
// Entrée et sortie du Chabbat, avec la paracha qu'on y lit.
//
// Composant à part parce que sa place dans la page change : le vendredi il
// passe devant les horaires du jour, c'est ce qu'on vient chercher. Le sortir
// ici évite d'écrire deux fois le même bloc pour deux positions.
//
// Encadré, contrairement aux groupes d'horaires qui s'enchaînent à plat : le
// Chabbat n'est pas un moment de la journée affichée mais un rendez-vous de la
// semaine, et le cadre marque cette différence de nature.
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
  <section class="card p-5">
    <!-- Le titre porte le nom de la paracha : c'est l'identité de ce Chabbat-là -->
    <h2 class="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-bold text-text-primary">
      <span class="flex items-center gap-2.5">
        <AppIcon name="candle" :size="17" class="text-primary" />
        {{ t("zmanim.shabbat.title") }}
      </span>
      <span v-if="parasha" class="flex flex-wrap items-baseline gap-x-1.5 text-sm font-normal">
        <span class="text-text-secondary">{{ t("zmanim.shabbat.parasha") }}</span>
        <template v-for="(entry, index) in parasha.entries" :key="entry.id">
          <span v-if="index > 0" class="text-text-secondary">·</span>
          <RouterLink :to="hubPath(entry)" class="font-medium text-primary hover:underline">
            {{ entry.name }}
          </RouterLink>
        </template>
      </span>
    </h2>

    <ul class="flex flex-col divide-y divide-line">
      <li class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ t("zmanim.shabbat.candleLighting") }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(times.candleLighting) }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(times.candleLighting) }}
        </span>
      </li>
      <li class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ t("zmanim.shabbat.havdalah") }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(times.havdalah) }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(times.havdalah) }}
        </span>
      </li>
    </ul>

    <p class="mt-2.5 text-xs text-text-secondary">{{ t("zmanim.shabbat.note") }}</p>
  </section>
</template>
