<script setup lang="ts">
import { useHolidayTheme } from "../../composables/useHolidayTheme";
import HolidayOrnaments from "../../components/holiday/HolidayOrnaments.vue";
import DailyStreakStats from "../../components/DailyStreakStats.vue";
import type { StreakStatus } from "../../services/dailyStreak";

// `streak` : la série de jours de la lecture du jour, null tant qu'elle
// n'est pas connue (le compte se lit encore).
defineProps<{
  userDisplayName: string;
  streak?: StreakStatus | null;
}>();

// Le temps d'une fête, ses ornements en blanc sur le bandeau, à côté du nom.
const { activeHolidayTheme } = useHolidayTheme();
</script>

<template>
  <!-- Bandeau à plat : la couleur du thème, pleine, sans dégradé (docs/design.md). -->
  <div class="bg-primary py-14 px-6 md:px-12 mb-12">
    <div class="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-6">
      <h1 class="text-3xl md:text-4xl font-bold text-white tracking-tight">
        {{ userDisplayName }}
      </h1>
      <div class="flex items-center gap-6">
        <!-- La série de jours de la lecture du jour : les jours d'affilée et
             le record, en blanc sur le bandeau. La carte entière mène à la
             page où l'on fait monter le compteur. -->
        <RouterLink
          v-if="streak"
          to="/bibliotheque/lecture-du-jour"
          class="rounded-btn px-3 py-2 -mx-3 transition-colors hover:bg-white/10"
        >
          <DailyStreakStats :status="streak" tone="banner" />
        </RouterLink>
        <HolidayOrnaments
          v-if="activeHolidayTheme"
          :theme="activeHolidayTheme.id"
          class="shrink-0 text-[2.75rem] text-white md:text-[3.5rem]"
          aria-hidden="true"
        />
      </div>
    </div>
  </div>
</template>
