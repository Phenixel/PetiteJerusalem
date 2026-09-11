<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "../composables/useNow";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useLocalePath } from "../composables/useLocalePath";
import { useHebrewOccasions } from "../composables/useHebrewOccasions";
import { upcomingOccasions, type OccasionKind } from "../services/hebrewOccasions";
import { formatHebrewDate, hebrewDayOf } from "../services/zmanimService";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";
import type { IconName } from "./icons/registry";

/**
 * Les dates qu'on a posées soi-même et qui arrivent : un anniversaire, un
 * leilouy nichmat (voir useHebrewOccasions).
 *
 * Elles vivent dans le calendrier, mais le calendrier, on n'y va pas tous les
 * jours : une date qu'on a pris la peine d'inscrire mérite de venir au-devant.
 * Le bandeau ne paraît donc que dans la semaine qui précède, et s'efface
 * ensuite, comme celui de la bénédiction de la lune.
 *
 * Une ligne par date, au plus trois : au-delà, ce n'est plus un rappel, c'est
 * une liste, et la liste a sa place dans le calendrier.
 */
const { t, locale } = useI18n();
const { place } = useZmanimLocation();
const { localePath } = useLocalePath();
const { occasions } = useHebrewOccasions();

// Horloge partagée des cartes de l'accueil : le bandeau change de jour tout
// seul, sans qu'on ait à rouvrir l'app.
const now = useNow();

/**
 * Le jour compté est le jour CIVIL, comme dans le calendrier : « demain » doit
 * vouloir dire demain, et non ce soir parce que le jour hébraïque a basculé à
 * la chkia. L'entrée du jour, elle, est annoncée par la notification, qui part
 * au coucher du soleil (voir zmanReminderService).
 */
const upcoming = computed(() =>
  upcomingOccasions(occasions.value, hebrewDayOf(place.value, now.value)),
);

const KIND_ICONS: Record<OccasionKind, IconName> = {
  yahrzeit: "candle",
  birthday: "cake",
  other: "calendar",
};

/** « Aujourd'hui, 12 Kislev 5787 », « Dans 3 jours, … ». */
function when(inDays: number, date: Parameters<typeof formatHebrewDate>[0]): string {
  const label =
    inDays === 0
      ? t("occasions.when.today")
      : inDays === 1
        ? t("occasions.when.tomorrow")
        : t("occasions.when.inDays", { n: inDays });
  return t("occasions.banner", { when: label, date: formatHebrewDate(date, locale.value) });
}
</script>

<template>
  <RouterLink
    v-for="entry in upcoming"
    :key="entry.occasion.id"
    :to="localePath('calendrier')"
    class="card card-hover group flex items-center justify-between gap-3 p-4"
    @click="analyticsService.capture('occasion_opened', { source: 'home' })"
  >
    <span class="flex min-w-0 items-center gap-3">
      <AppIcon :name="KIND_ICONS[entry.occasion.kind]" :size="20" class="shrink-0 text-primary" />
      <span class="min-w-0">
        <span
          class="block truncate font-medium leading-snug text-text-primary transition-colors group-hover:text-primary"
        >
          {{ entry.occasion.name }}
        </span>
        <span class="block text-xs text-text-secondary">
          {{ when(entry.inDays, entry.date) }}
        </span>
      </span>
    </span>
  </RouterLink>
</template>
