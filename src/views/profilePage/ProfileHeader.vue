<script setup lang="ts">
import { computed } from "vue";
import { useHolidayTheme } from "../../composables/useHolidayTheme";
import HolidayOrnaments from "../../components/holiday/HolidayOrnaments.vue";

const props = defineProps<{
  userDisplayName: string;
  email?: string;
}>();

/** L'initiale du nom, dans son rond, comme dans le profil de l'app. */
const initial = computed(() => Array.from(props.userDisplayName.trim())[0]?.toUpperCase() ?? "?");

// Le temps d'une fête, ses ornements en blanc sur le bandeau, à côté du nom.
const { activeHolidayTheme } = useHolidayTheme();
</script>

<template>
  <!-- Bandeau à plat : la teinte du thème, pleine, sans dégradé (docs/design.md).
       En haut, qui l'on est : le rond à l'initiale, le nom et, à côté de lui,
       ce que la page y pose (#name : la pastille de la lumière de la série et
       de ses jours), l'adresse dessous. En bas, sur toute la largeur, la suite (la journée et
       sa barre). -->
  <div class="mb-12 bg-brand text-on-brand">
    <div
      class="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 pt-9 pb-7 md:px-12 md:pt-12 md:pb-9"
    >
      <div class="flex min-w-0 items-center gap-4 md:gap-5">
        <!-- Le rond à l'initiale, dès qu'il y a la place : sur un téléphone, le
             nom et la lumière prennent toute la ligne. -->
        <span
          class="font-display hidden h-16 w-16 flex-none items-center justify-center rounded-full bg-surface text-3xl text-primary sm:flex md:h-20 md:w-20 md:text-4xl"
          aria-hidden="true"
        >
          {{ initial }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 class="min-w-0 break-words text-2xl font-bold tracking-tight md:text-4xl">
              {{ userDisplayName }}
            </h1>
            <slot name="name" />
          </span>
          <span v-if="email" class="banner-soft mt-0.5 block truncate text-sm">{{ email }}</span>
        </span>
        <HolidayOrnaments
          v-if="activeHolidayTheme"
          :theme="activeHolidayTheme.id"
          class="shrink-0 text-[2.25rem] md:text-[3rem]"
          aria-hidden="true"
        />
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.banner-soft {
  color: color-mix(in srgb, var(--color-on-brand) 78%, transparent);
}
</style>
