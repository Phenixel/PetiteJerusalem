<script setup lang="ts">
/**
 * Widget « Paracha de la semaine » : celle qu'on lira ce Chabbat (samedi soir,
 * après la chkia, déjà la suivante), au calendrier du lieu des horaires. Il
 * mène au chnei mikra.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useWeeklyParasha } from "../../composables/useTehilimDay";
import { parashaTitle, shabbatOfWeek } from "../../services/dailyCycles";
import { dateTimeFormat } from "../../services/intlCache";
import AppIcon from "../icons/AppIcon.vue";

const { t, locale } = useI18n();

const { parasha } = useWeeklyParasha();

const title = computed(() => parashaTitle(parasha.value));

/** « Lue Chabbat 8 août », comme sur la page du chnei mikra. */
const shabbat = computed(() => {
  if (!parasha.value) return "";
  const date = dateTimeFormat(locale.value, { day: "numeric", month: "long" }).format(
    shabbatOfWeek(parasha.value.weekKey),
  );
  return t("chneiMikra.shabbatOn", { date });
});
</script>

<template>
  <RouterLink
    v-if="parasha"
    to="/bibliotheque/chnei-mikra"
    class="card card-hover p-5 md:p-6 block group"
  >
    <h3
      class="font-semibold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
    >
      <AppIcon name="scroll" :size="17" class="shrink-0 text-primary" />
      {{ t("home.widgets.catalog.parasha.name") }}
    </h3>
    <p class="mt-3 font-display text-2xl font-bold tracking-tight text-text-primary">
      {{ title }}
    </p>
    <p class="mt-1 text-sm text-text-secondary">{{ shabbat }}</p>
  </RouterLink>
</template>
