<script setup lang="ts">
import { useHolidayTheme } from "../../composables/useHolidayTheme";
import HolidayOrnaments from "../../components/holiday/HolidayOrnaments.vue";

defineProps<{
  userDisplayName: string;
}>();

// Le temps d'une fête, ses ornements en blanc sur le bandeau, à côté du nom.
const { activeHolidayTheme } = useHolidayTheme();
</script>

<template>
  <!-- Bandeau à plat : la couleur du thème, pleine, sans dégradé (docs/design.md). -->
  <div class="bg-primary py-14 px-6 md:px-12 mb-12">
    <div class="max-w-[1200px] mx-auto flex items-center justify-between gap-6">
      <h1 class="text-3xl md:text-4xl font-bold text-white tracking-tight">
        {{ userDisplayName }}
      </h1>
      <HolidayOrnaments
        v-if="activeHolidayTheme"
        :theme="activeHolidayTheme.id"
        class="shrink-0 text-[2.75rem] text-white md:text-[3.5rem]"
        aria-hidden="true"
      />
    </div>
  </div>
</template>
