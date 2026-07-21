<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { Chiour } from "../models/models";
import { chiourService } from "../services/chiourService";
import { useViewedChiourim } from "../composables/useViewedChiourim";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();
const router = useRouter();
const { isViewed } = useViewedChiourim();

interface Props {
  chiour: Chiour;
  /** Nom de la série du chiour, si la page appelante le connaît (badge épisode). */
  serieName?: string;
}

defineProps<Props>();

function goToDetail(chiour: Chiour) {
  router.push(`/chiourim/${chiour.slug}`);
}

function goToAuteur(event: Event, auteur: string) {
  event.stopPropagation();
  router.push(`/chiourim/auteur/${chiourService.generateAuteurSlug(auteur)}`);
}
</script>

<template>
  <div
    class="card card-hover flex flex-col p-6 cursor-pointer group"
    @click="goToDetail(chiour)"
  >
    <div class="flex justify-between items-start gap-3 mb-3">
      <h4
        class="text-lg font-bold text-text-primary group-hover:text-primary transition-colors line-clamp-2"
      >
        {{ chiour.name }}
      </h4>
      <!-- Déjà vu (utilisateur connecté uniquement), en haut à droite -->
      <span
        v-if="isViewed(chiour.slug)"
        class="chip bg-green-600/10 text-green-700 inline-flex items-center gap-1 shrink-0 dark:text-green-300"
      >
        <AppIcon name="circle-check" :size="12" />
        {{ t("common.viewed") }}
      </span>
    </div>

    <!-- Categories badges -->
    <div class="flex flex-wrap gap-2 mb-3">
      <span
        v-if="serieName"
        class="chip bg-secondary/10 text-secondary inline-flex items-center gap-1"
      >
        <AppIcon name="book-open" :size="12" />
        <template v-if="chiour.episode != null">
          {{ t("serie.episodeBadge", { n: chiour.episode }) }}
        </template>
        <template v-else>{{ serieName }}</template>
      </span>
      <span v-for="cat in chiour.categories" :key="cat" class="chip bg-primary/10 text-primary">
        {{ cat }}
      </span>
    </div>

    <p v-if="chiour.description" class="text-text-secondary text-sm mb-4 line-clamp-2">
      {{ chiour.description }}
    </p>

    <div class="flex items-center gap-4 mb-3">
      <button
        v-if="chiour.auteur"
        @click="goToAuteur($event, chiour.auteur)"
        class="inline-flex items-center gap-1.5 text-text-secondary hover:text-primary transition-colors"
      >
        <AppIcon name="teacher" :size="15" />
        <strong class="font-semibold underline decoration-dotted underline-offset-2">{{
          chiour.auteur
        }}</strong>
      </button>
      <div
        v-if="chiour.niveau"
        class="inline-flex items-center gap-1.5 text-text-secondary text-sm"
      >
        <AppIcon name="signal" :size="15" />
        {{ chiour.niveau }}
      </div>
    </div>

    <div class="flex-grow"></div>

    <div v-if="chiour.mediaUrl" class="mt-auto pt-3 flex items-center justify-end">
      <span
        class="text-sm text-primary font-medium flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <AppIcon name="headphones" :size="15" />
        {{ t("chiourim.listen") }}
      </span>
    </div>
  </div>
</template>
