<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { Chiour } from "../models/models";

const { t } = useI18n();
const router = useRouter();

interface Props {
  chiour: Chiour;
}

defineProps<Props>();

function goToDetail(chiour: Chiour) {
  router.push(`/chiourim/${chiour.slug}`);
}
</script>

<template>
  <div
    class="block bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-white/60 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-white/90 group dark:bg-gray-800/60 dark:border-gray-700 dark:hover:bg-gray-800/80"
    @click="goToDetail(chiour)"
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
      v-if="chiour.mediaUrl"
      class="pt-3 border-t border-black/5 flex items-center justify-end dark:border-white/10"
    >
      <span
        class="text-sm text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <i class="fa-solid fa-headphones mr-1"></i>
        {{ t("chiourim.listen") }}
      </span>
    </div>
  </div>
</template>
