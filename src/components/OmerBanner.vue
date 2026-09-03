<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useNow } from "../composables/useNow";
import { hebrewDateFor } from "../services/zmanimService";
import { omerDay } from "../services/dailyCycles";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";

/**
 * Le compte du 'Omer, les quarante-neuf soirs où il se dit.
 *
 * Même forme que la bénédiction de la lune : un compte se rate d'un soir, et
 * qui saute un jour entier perd la bénédiction pour tout le reste. Le bandeau
 * dit le compte du jour et mène droit à l'endroit où il se lit, à la fin
 * d'Arvit.
 *
 * Le jour hébraïque bascule à la chkia, et c'est bien celui-là qu'il faut :
 * le compte dit le soir vaut pour le jour qui vient de s'ouvrir, et c'est
 * celui-là qu'un calendrier nomme jusqu'au lendemain soir. D'où hebrewDateFor,
 * qui tient compte de l'heure, et le minuteur qui la suit.
 */
const { t, locale } = useI18n();
const { place } = useZmanimLocation();

// Horloge partagée entre les cartes de l'accueil (un seul setInterval).
const now = useNow();

const jour = computed(() => omerDay(hebrewDateFor(place.value, now.value, now.value)));

/** Ce qui reste à compter, l'aujourd'hui compris : « plus que 12 soirs ». */
const restants = computed(() => (jour.value === null ? 0 : 49 - jour.value));

const compte = computed(() => {
  const n = jour.value;
  if (n === null) return "";
  // Le premier jour a son ordinal à lui en français ; les autres suivent la
  // même forme. Les autres langues n'ont qu'une tournure.
  return n === 1 && locale.value === "fr" ? t("home.omer.dayOne") : t("home.omer.day", { n });
});
</script>

<template>
  <RouterLink
    v-if="jour !== null"
    to="/bibliotheque/sidour/arvit"
    class="card card-hover mb-5 flex items-center justify-between gap-3 p-4 group"
    @click="analyticsService.capture('omer_opened', { source: 'home', day: jour })"
  >
    <span class="flex min-w-0 items-center gap-3">
      <AppIcon name="hourglass" :size="20" class="shrink-0 text-primary" />
      <span class="min-w-0">
        <span
          class="block font-medium leading-snug text-text-primary transition-colors group-hover:text-primary"
        >
          {{ compte }}
        </span>
        <span class="block text-xs text-text-secondary">
          {{ restants > 0 ? t("home.omer.remaining", { n: restants }) : t("home.omer.last") }}
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
