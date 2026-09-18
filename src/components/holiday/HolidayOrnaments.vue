<script setup lang="ts">
import type { HolidayThemeId } from "../../services/holidayThemes";
import { HOLIDAY_ORNAMENTS } from "./ornaments";

/**
 * Les deux ornements d'un thème de fête côte à côte, à la taille du texte
 * courant : l'aperçu des réglages. Sur l'accueil, ils encadrent un souhait
 * (voir HolidayGreeting).
 */
defineProps<{ theme: HolidayThemeId }>();
</script>

<template>
  <span class="inline-flex items-center gap-[0.35em]">
    <span class="block h-[1em] w-[1em]"><component :is="HOLIDAY_ORNAMENTS[theme][0]" /></span>
    <span class="block h-[1em] w-[1em]"><component :is="HOLIDAY_ORNAMENTS[theme][1]" /></span>
  </span>
</template>
