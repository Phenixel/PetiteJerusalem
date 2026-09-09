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

<!-- Composition : le texte serré à gauche (le titre puis le compte, l'un sous
     l'autre), le pourcentage en grand à droite, centré sur le bloc de texte.
     Le chiffre est la réponse que la carte apporte, et la seule chose qu'elle
     porte à ce corps-là ; la barre, dessous, la précise. Même rythme que la
     carte des horaires, dont le chiffre tombe au même endroit. -->
<template>
  <RouterLink to="/bibliotheque/lecture-du-jour" class="card card-hover p-5 md:p-6 block group">
    <!-- Liste vide : inviter à la composer -->
    <template v-if="total === 0">
      <h3
        class="font-semibold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
      >
        <AppIcon name="book" :size="17" class="text-primary" />
        {{ t("dailyReading.title") }}
      </h3>
      <p class="mt-3 text-sm text-text-secondary leading-relaxed">
        {{ t("home.dashboard.readingEmpty") }}
      </p>
      <!-- Liste déjà composée : pas de « voir ma lecture », la carte entière
           est un lien, l'invitation à cliquer serait redondante. Liste vide,
           en revanche, la suite ne va pas de soi : on l'annonce. -->
      <p class="mt-4 text-sm font-medium text-primary">
        {{ t("home.dashboard.readingSetupCta") }}
      </p>
    </template>

    <template v-else>
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <h3
            class="font-semibold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
          >
            <AppIcon name="book" :size="17" class="shrink-0 text-primary" />
            {{ t("dailyReading.title") }}
          </h3>
          <p
            class="mt-1 text-sm font-medium"
            :class="allDone ? 'text-green-600 dark:text-green-400' : 'text-text-secondary'"
          >
            <template v-if="allDone">
              {{ t("dailyReading.allReadTitle") }}
            </template>
            <template v-else>
              {{ t("dailyReading.progress", { done, total }) }}
            </template>
          </p>
        </div>
        <span
          class="shrink-0 text-4xl md:text-5xl font-bold leading-none tabular-nums"
          :class="allDone ? 'text-green-600 dark:text-green-400' : 'text-primary'"
        >
          {{ pct }}<span class="text-xl md:text-2xl">%</span>
        </span>
      </div>
      <ProgressBar class="mt-4" :value="pct" :label="t('dailyReading.title')" />
    </template>
  </RouterLink>
</template>
