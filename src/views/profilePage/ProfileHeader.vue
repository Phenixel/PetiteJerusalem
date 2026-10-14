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
  <!-- Bandeau à plat : la teinte du thème, pleine, sans dégradé (docs/design.md).
       Le nom, et à côté ce que la page y pose (Mon parcours : la lumière de la
       série, la journée) ; dessous sur un téléphone. -->
  <div class="bg-brand py-10 px-6 md:py-14 md:px-12 mb-12">
    <div
      class="max-w-[1200px] mx-auto flex flex-col gap-7 md:flex-row md:items-center md:justify-between"
    >
      <div class="flex items-center justify-between gap-6">
        <h1 class="text-3xl md:text-4xl font-bold text-on-brand tracking-tight">
          {{ userDisplayName }}
        </h1>
        <HolidayOrnaments
          v-if="activeHolidayTheme"
          :theme="activeHolidayTheme.id"
          class="shrink-0 text-[2.75rem] text-on-brand md:text-[3.5rem]"
          aria-hidden="true"
        />
      </div>
      <slot />
    </div>
  </div>
</template>
