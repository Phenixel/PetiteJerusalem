<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Chiour } from "../models/models";

const { t } = useI18n();

interface Props {
  chiour: Chiour;
}

const props = defineProps<Props>();

const categoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    "Hovot Halévavot": "fa-solid fa-heart",
    Halaha: "fa-solid fa-scale-balanced",
    Paracha: "fa-solid fa-scroll",
  };
  return icons[category] || "fa-solid fa-bookmark";
};

const chiourLink = computed(() => {
  return props.chiour.mediaUrl || "";
});
</script>

<template>
  <a
    :href="chiourLink || undefined"
    :target="chiourLink ? '_blank' : undefined"
    :rel="chiourLink ? 'noopener noreferrer' : undefined"
    :class="[
      'block bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-white/90 group dark:bg-gray-800/60 dark:border-gray-700 dark:hover:bg-gray-800/80',
      chiourLink ? 'cursor-pointer' : 'cursor-default',
    ]"
  >
    <div class="flex justify-between items-start mb-3">
      <h4
        class="text-lg font-bold text-text-primary group-hover:text-primary transition-colors dark:text-gray-100 dark:group-hover:text-primary line-clamp-2"
      >
        {{ chiour.name }}
      </h4>
    </div>

    <!-- Categories badges -->
    <div class="flex flex-wrap gap-2 mb-3">
      <span
        v-for="cat in chiour.categories"
        :key="cat"
        class="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap dark:bg-primary/20"
      >
        <i :class="categoryIcon(cat)" class="mr-1"></i>
        {{ cat }}
      </span>
    </div>

    <p
      v-if="chiour.description"
      class="text-text-secondary text-sm mb-4 line-clamp-2 dark:text-gray-400"
    >
      {{ chiour.description }}
    </p>

    <div class="flex items-center gap-4 mb-3">
      <div v-if="chiour.auteur" class="text-text-secondary dark:text-gray-400">
        <i class="fa-solid fa-chalkboard-user mr-1"></i>
        <strong class="text-text-primary font-semibold dark:text-gray-300">{{
          chiour.auteur
        }}</strong>
      </div>
      <div
        v-if="chiour.niveau"
        class="text-text-secondary text-sm dark:text-gray-400"
      >
        <i class="fa-solid fa-signal mr-1"></i>
        {{ chiour.niveau }}
      </div>
    </div>

    <div
      v-if="chiourLink"
      class="pt-3 border-t border-black/5 flex items-center justify-end dark:border-white/10"
    >
      <span
        class="text-sm text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {{ t("chiourim.openLink") }}
        <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
      </span>
    </div>
  </a>
</template>
