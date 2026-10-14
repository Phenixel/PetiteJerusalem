<script setup lang="ts">
/**
 * L'étagère de l'accueil (P2-Accueil) : les volumes du parcours, un par
 * objectif qui se lit, posés sur leur planche, sans titre au-dessus. Un
 * volume touché ouvre son programme ; « Un volume » en ajoute un. Rien tant
 * qu'aucun volume n'y est posé.
 *
 * Chargée à la demande (voir HomeView) : elle tire le calendrier hébraïque.
 */
import { computed } from "vue";
import { useParcours } from "../../../composables/useParcours";
import { liveObjectives } from "../../../services/parcours/schedule";
import VolumeShelf from "../VolumeShelf.vue";

const store = useParcours();

const hasVolumes = computed(() =>
  liveObjectives(store.data.value).some((objective) => objective.kind !== "habit"),
);
</script>

<template>
  <div v-if="hasVolumes">
    <VolumeShelf home />
  </div>
</template>
