<script setup lang="ts">
// La série de jours en deux chiffres, pour le bandeau du profil et la carte
// du tableau de bord : les jours d'affilée, et le record. Pas un mot de
// plus ; l'explication vit sur la page de la lecture du jour
// (DailyStreakBanner), où l'on agit dessus.
//
// `tone` : sur le bandeau de couleur du profil, tout est blanc (le bandeau
// est plein, voir docs/design.md) ; sur une carte, la flamme prend l'accent.
import { useI18n } from "vue-i18n";
import type { StreakStatus } from "../services/dailyStreak";
import AppIcon from "./icons/AppIcon.vue";

withDefaults(defineProps<{ status: StreakStatus; tone?: "card" | "banner" }>(), {
  tone: "card",
});

const { t } = useI18n();
</script>

<template>
  <div
    class="flex items-center gap-4"
    :class="tone === 'banner' ? 'text-white' : 'text-text-secondary'"
  >
    <div class="flex items-center gap-2" :title="t('dailyReading.streak.title')">
      <AppIcon
        name="flame"
        :size="tone === 'banner' ? 28 : 16"
        :class="
          tone === 'banner'
            ? status.current > 0
              ? 'text-white'
              : 'text-white/50'
            : status.current > 0
              ? 'text-primary'
              : 'text-text-secondary/40'
        "
      />
      <span class="flex flex-col leading-none">
        <span
          class="font-bold tabular-nums"
          :class="
            tone === 'banner' ? 'text-2xl md:text-3xl text-white' : 'text-lg text-text-primary'
          "
        >
          {{ status.current }}
        </span>
        <span class="text-xs" :class="tone === 'banner' ? 'text-white/80' : ''">
          {{ t("dailyReading.streak.days", status.current) }}
        </span>
      </span>
    </div>
    <div
      class="flex items-center gap-2"
      :class="tone === 'banner' ? 'text-white/85' : ''"
      :title="t('dailyReading.streak.bestTitle')"
    >
      <AppIcon
        name="trophy"
        :size="tone === 'banner' ? 22 : 14"
        :class="tone === 'banner' ? 'text-white/70' : 'text-text-secondary/60'"
      />
      <span class="flex flex-col leading-none">
        <span
          class="font-bold tabular-nums"
          :class="
            tone === 'banner' ? 'text-2xl md:text-3xl text-white' : 'text-lg text-text-primary'
          "
        >
          {{ status.best }}
        </span>
        <span class="text-xs" :class="tone === 'banner' ? 'text-white/80' : ''">
          {{ t("dailyReading.streak.bestShort") }}
        </span>
      </span>
    </div>
  </div>
</template>
