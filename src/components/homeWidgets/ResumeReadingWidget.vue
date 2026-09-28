<script setup lang="ts">
/**
 * Widget « Reprendre ma lecture » : le dernier texte ouvert dans la
 * bibliothèque, au verset près, le même que la ligne de reprise en tête de la
 * bibliothèque (readingProgressService.getResumePosition).
 *
 * Choisi par la personne, il ne disparaît pas quand il n'a rien à reprendre :
 * il le dit, et mène à la bibliothèque.
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  readingProgressService,
  type ReadingPosition,
} from "../../services/readingProgressService";
import AppIcon from "../icons/AppIcon.vue";

const { t } = useI18n();

const last = ref<ReadingPosition | null>(null);

const to = computed(() =>
  last.value
    ? { path: last.value.path, query: { verset: String(last.value.line) } }
    : "/bibliotheque",
);

onMounted(() => {
  // La position de l'appareil tout de suite, celle du compte quand la
  // synchronisation aboutit (une lecture faite sur un autre appareil).
  last.value = readingProgressService.getResumePosition();
  void readingProgressService.ensureSynced().then(() => {
    last.value = readingProgressService.getResumePosition();
  });
});
</script>

<template>
  <RouterLink :to="to" class="card card-hover p-5 md:p-6 block group">
    <h3
      class="font-semibold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
    >
      <AppIcon name="bookmark" :size="17" class="shrink-0 text-primary" />
      {{ t("home.widgets.catalog.resume_reading.name") }}
    </h3>
    <template v-if="last">
      <p class="mt-3 text-lg font-medium leading-snug text-text-primary">{{ last.label }}</p>
      <p class="mt-1 text-sm text-text-secondary">
        {{ t("home.widgets.resume.verse", { n: last.line + 1 }) }}
      </p>
    </template>
    <template v-else>
      <p class="mt-3 text-sm text-text-secondary leading-relaxed">
        {{ t("home.widgets.resume.empty") }}
      </p>
      <p class="mt-4 text-sm font-medium text-primary">{{ t("home.widgets.resume.emptyCta") }}</p>
    </template>
  </RouterLink>
</template>
