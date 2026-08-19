<script setup lang="ts">
// Carte « Lecture quotidienne » du tableau de bord : où j'en suis aujourd'hui.
// Partagée entre l'accueil et la bibliothèque pour garder un seul design.
// Purement présentationnelle : le parent charge les compteurs et pose ses
// éventuels handlers (analytics) directement sur le composant.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";

const props = defineProps<{ done: number; total: number }>();

const { t } = useI18n();

const pct = computed(() =>
  props.total === 0 ? 0 : Math.round((props.done / props.total) * 100),
);
const allDone = computed(() => props.total > 0 && props.done >= props.total);
</script>

<template>
  <RouterLink to="/bibliotheque/lecture-du-jour" class="card card-hover p-6 block group">
    <div class="flex items-center justify-between gap-3 mb-4">
      <h3
        class="font-bold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
      >
        <AppIcon name="book" :size="17" class="text-primary" />
        {{ t("dailyReading.title") }}
      </h3>
      <AppIcon name="chevron-right" :size="15" class="text-text-secondary/50 rtl:rotate-180" />
    </div>

    <!-- Liste vide : inviter à la composer -->
    <p v-if="total === 0" class="text-sm text-text-secondary leading-relaxed">
      {{ t("home.dashboard.readingEmpty") }}
    </p>

    <template v-else>
      <div class="flex items-center justify-between mb-2">
        <span
          class="text-sm font-medium"
          :class="allDone ? 'text-green-600 dark:text-green-400' : 'text-text-primary'"
        >
          <template v-if="allDone">
            {{ t("dailyReading.allReadTitle") }}
          </template>
          <template v-else>
            {{ t("dailyReading.progress", { done, total }) }}
          </template>
        </span>
        <span class="text-sm font-semibold text-primary">{{ pct }}%</span>
      </div>
      <div class="h-2 w-full rounded-full bg-black/5 overflow-hidden dark:bg-white/10">
        <div
          class="h-full rounded-full bg-primary transition-all duration-500"
          :style="{ width: `${pct}%` }"
        ></div>
      </div>
    </template>

    <!-- Liste déjà composée : pas de « voir ma lecture », la carte entière est
         un lien (chevron compris), l'invitation à cliquer serait redondante.
         Liste vide, en revanche, la suite ne va pas de soi : on l'annonce. -->
    <p v-if="total === 0" class="mt-4 text-sm font-medium text-primary flex items-center gap-1.5">
      {{ t("home.dashboard.readingSetupCta") }}
    </p>
  </RouterLink>
</template>
