<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { Chiour } from "../models/models";
import { DateService } from "../services/dateService";

const { t } = useI18n();

interface Props {
  chiour: Chiour;
}

defineProps<Props>();

const formatDate = (date: Date): string => {
  return DateService.formatDate(date);
};

const categoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    guemara: "fa-solid fa-book-open",
    halakha: "fa-solid fa-scale-balanced",
    paracha: "fa-solid fa-scroll",
    moussar: "fa-solid fa-heart",
    hassidout: "fa-solid fa-star",
    other: "fa-solid fa-bookmark",
  };
  return icons[category] || icons.other;
};
</script>

<template>
  <a
    :href="chiour.link"
    target="_blank"
    rel="noopener noreferrer"
    class="block bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-white/60 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-white/90 group dark:bg-gray-800/60 dark:border-gray-700 dark:hover:bg-gray-800/80"
  >
    <div class="flex justify-between items-start mb-3">
      <h4
        class="text-lg font-bold text-text-primary group-hover:text-primary transition-colors dark:text-gray-100 dark:group-hover:text-primary line-clamp-2"
      >
        {{ chiour.title }}
      </h4>
      <span
        class="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap ml-3 dark:bg-primary/20"
      >
        <i :class="categoryIcon(chiour.category)" class="mr-1"></i>
        {{ t(`chiourim.categories.${chiour.category}`) }}
      </span>
    </div>

    <p
      v-if="chiour.description"
      class="text-text-secondary text-sm mb-4 line-clamp-2 dark:text-gray-400"
    >
      {{ chiour.description }}
    </p>

    <div class="flex items-center gap-4 mb-3">
      <div class="text-text-secondary dark:text-gray-400">
        <i class="fa-solid fa-chalkboard-user mr-1"></i>
        <strong class="text-text-primary font-semibold dark:text-gray-300">{{
          chiour.teacher
        }}</strong>
      </div>
      <div v-if="chiour.duration" class="text-text-secondary text-sm dark:text-gray-400">
        <i class="fa-regular fa-clock mr-1"></i>
        {{ chiour.duration }}
      </div>
    </div>

    <div class="pt-3 border-t border-black/5 flex items-center justify-between dark:border-white/10">
      <span class="text-sm text-text-secondary flex items-center gap-2 dark:text-gray-400">
        <i class="far fa-calendar-alt"></i>
        {{ formatDate(chiour.datePublished) }}
      </span>
      <span
        class="text-sm text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {{ t("chiourim.openLink") }}
        <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
      </span>
    </div>
  </a>
</template>
