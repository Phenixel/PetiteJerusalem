<script setup lang="ts" generic="F extends string">
import AppIcon from "../icons/AppIcon.vue";
import { liveValue } from "../../composables/liveInput";

/**
 * Filtres et recherche d'une liste du backoffice. Chaque filtre porte son
 * compte : on voit avant de cliquer qu'il y a trois chiourim à relire, et un
 * filtre vide se lit comme tel. Le filtre actif prend la couleur pleine.
 */
defineProps<{
  filters: { id: F; label: string; count?: number }[];
  searchPlaceholder: string;
}>();

const filter = defineModel<F>("filter", { required: true });
const search = defineModel<string>("search", { default: "" });
</script>

<template>
  <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
    <div class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
      <button
        v-for="f in filters"
        :key="f.id"
        type="button"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors"
        :class="
          filter === f.id
            ? 'bg-primary text-white'
            : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
        "
        :aria-pressed="filter === f.id"
        @click="filter = f.id"
      >
        {{ f.label }}
        <span
          v-if="f.count !== undefined"
          class="rounded-pill px-1.5 text-xs tabular-nums"
          :class="filter === f.id ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'"
        >
          {{ f.count }}
        </span>
      </button>
    </div>
    <div class="flex items-center gap-2 md:ml-auto">
      <slot />
      <div class="relative flex-1 md:w-64 md:flex-none">
        <AppIcon
          name="search"
          :size="14"
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
        />
        <input
          :value="search"
          type="search"
          :placeholder="searchPlaceholder"
          class="field pl-9"
          @input="search = liveValue($event)"
        />
      </div>
    </div>
  </div>
</template>
