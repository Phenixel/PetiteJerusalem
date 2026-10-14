<script setup lang="ts">
/**
 * L'étagère de l'accueil : les volumes du parcours (un par objectif qui se
 * lit), et le chemin vers Mon parcours. Rien tant qu'aucun volume n'y est
 * posé.
 *
 * Chargée à la demande (voir HomeView) : elle tire le calendrier hébraïque.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../../composables/useParcours";
import { liveObjectives } from "../../../services/parcours/schedule";
import VolumeShelf from "../VolumeShelf.vue";

const { t } = useI18n();
const store = useParcours();

const hasVolumes = computed(() =>
  liveObjectives(store.data.value).some((objective) => objective.kind !== "habit"),
);
</script>

<template>
  <section v-if="hasVolumes">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="text-xl font-bold">{{ t("parcours.shelf.title") }}</h2>
      <RouterLink to="/parcours" class="text-sm font-bold text-primary">
        {{ t("parcours.title") }}
      </RouterLink>
    </div>
    <VolumeShelf class="mt-3" />
  </section>
</template>
