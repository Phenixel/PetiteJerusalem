<script setup lang="ts">
interface Props {
  searchTerm: string;
  placeholder?: string;
}

interface Emits {
  (e: "update:searchTerm", value: string): void;
  (e: "clear-search"): void;
}

withDefaults(defineProps<Props>(), {
  placeholder: "Rechercher...",
});

const emit = defineEmits<Emits>();

const clearSearch = () => {
  emit("update:searchTerm", "");
  emit("clear-search");
};
</script>

<template>
  <div class="search-section mb-6">
    <div class="search-container flex flex-col gap-2">
      <div class="search-input-wrapper relative flex items-center">
        <input
          type="text"
          :value="searchTerm"
          @input="emit('update:searchTerm', ($event.target as HTMLInputElement).value)"
          :placeholder="placeholder"
          class="search-input w-full px-4 py-3 rounded-xl border border-white/30 bg-white/40 backdrop-blur-sm text-text-primary placeholder-text-secondary/70 shadow-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white/60 dark:bg-gray-800/40 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-800/60"
        />
        <button
          v-if="searchTerm"
          @click="clearSearch"
          class="clear-search-btn absolute right-3 w-6 h-6 flex items-center justify-center rounded-full bg-black/5 text-text-secondary hover:bg-black/10 transition-colors dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20"
          title="Effacer la recherche"
        >
          ✕
        </button>
      </div>
      <div
        v-if="searchTerm"
        class="search-info text-sm text-text-secondary ml-1 italic dark:text-gray-400"
      >
        Recherche : "{{ searchTerm }}"
      </div>
    </div>
  </div>
</template>
