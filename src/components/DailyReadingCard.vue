<script setup lang="ts">
// Carte « Lecture quotidienne » du tableau de bord : où j'en suis aujourd'hui.
// Partagée entre l'accueil et la bibliothèque pour garder un seul design.
// Purement présentationnelle : le parent charge les compteurs et pose ses
// éventuels handlers (analytics) directement sur le composant.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import ProgressBar from "./ProgressBar.vue";

const props = defineProps<{ done: number; total: number }>();

const { t } = useI18n();

const pct = computed(() => (props.total === 0 ? 0 : Math.round((props.done / props.total) * 100)));
const allDone = computed(() => props.total > 0 && props.done >= props.total);
</script>

<template>
  <RouterLink to="/bibliotheque/lecture-du-jour" class="card card-hover p-6 block group">
    <div class="mb-4">
      <h3
        class="font-semibold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
      >
        <AppIcon name="book" :size="17" class="text-primary" />
        {{ t("dailyReading.title") }}
      </h3>
    </div>

    <!-- Liste vide : inviter à la composer -->
    <p v-if="total === 0" class="text-sm text-text-secondary leading-relaxed">
      {{ t("home.dashboard.readingEmpty") }}
    </p>

    <!-- Où j'en suis, en grand : c'est la réponse que la carte apporte, et la
         seule chose qu'elle porte à ce corps-là. Le compte détaillé et la
         barre la précisent, en dessous. Même rythme que la carte des horaires,
         dont le chiffre tombe au même endroit. -->
    <template v-else>
      <div class="flex items-end justify-between gap-3 mb-2">
        <span
          class="text-sm font-medium"
          :class="allDone ? 'text-green-600 dark:text-green-400' : 'text-text-secondary'"
        >
          <template v-if="allDone">
            {{ t("dailyReading.allReadTitle") }}
          </template>
          <template v-else>
            {{ t("dailyReading.progress", { done, total }) }}
          </template>
        </span>
        <span
          class="shrink-0 text-4xl md:text-5xl font-bold leading-none tabular-nums"
          :class="allDone ? 'text-green-600 dark:text-green-400' : 'text-primary'"
        >
          {{ pct }}<span class="text-xl md:text-2xl">%</span>
        </span>
      </div>
      <ProgressBar :value="pct" :label="t('dailyReading.title')" />
    </template>

    <!-- Liste déjà composée : pas de « voir ma lecture », la carte entière est
         un lien (chevron compris), l'invitation à cliquer serait redondante.
         Liste vide, en revanche, la suite ne va pas de soi : on l'annonce. -->
    <p v-if="total === 0" class="mt-4 text-sm font-medium text-primary flex items-center gap-1.5">
      {{ t("home.dashboard.readingSetupCta") }}
    </p>
  </RouterLink>
</template>
