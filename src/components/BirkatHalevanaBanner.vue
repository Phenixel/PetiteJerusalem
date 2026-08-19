<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import {
  birkatHalevanaLastDay,
  formatHebrewDate,
  hebrewDateFor,
  saysBirkatHalevana,
} from "../services/zmanimService";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";

/**
 * La bénédiction de la lune, les nuits où elle se dit.
 *
 * Elle a une fenêtre courte, une fois par mois, et se rate facilement : rien
 * ne la rappelle et son texte dort au fond de la bibliothèque. Le bandeau ne
 * paraît que ces nuits-là, et disparaît le reste du mois.
 */
const { t, locale } = useI18n();
const { place } = useZmanimLocation();

// Le jour hébraïque change à la chkia, et la bénédiction se dit la nuit :
// c'est donc toujours du bon côté de la bascule qu'il faut la poser. D'où
// hebrewDateFor, qui tient compte de l'heure, et le minuteur qui la suit.
const now = ref(new Date());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => (now.value = new Date()), 60_000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});

const hebrewDay = computed(() => hebrewDateFor(place.value, now.value, now.value));
const visible = computed(() => saysBirkatHalevana(hebrewDay.value));

/** La date limite : la moitié de la lunaison. */
const deadline = computed(() =>
  formatHebrewDate(birkatHalevanaLastDay(hebrewDay.value), locale.value),
);
</script>

<template>
  <RouterLink
    v-if="visible"
    to="/bibliotheque/brahot/birkat-halevana"
    class="card card-hover mb-5 flex items-center justify-between gap-3 p-4 group"
    @click="analyticsService.capture('birkat_halevana_opened', { source: 'home' })"
  >
    <span class="flex min-w-0 items-center gap-3">
      <AppIcon name="moon" :size="20" class="shrink-0 text-primary" />
      <span class="min-w-0">
        <span
          class="block font-medium leading-snug text-text-primary transition-colors group-hover:text-primary"
        >
          {{ t("home.birkatHalevana.title") }}
        </span>
        <span class="block text-xs text-text-secondary">
          {{ t("home.birkatHalevana.until", { date: deadline }) }}
        </span>
      </span>
    </span>
    <AppIcon
      name="chevron-right"
      :size="16"
      class="shrink-0 text-text-secondary/50 transition-colors group-hover:text-primary rtl:rotate-180"
    />
  </RouterLink>
</template>
