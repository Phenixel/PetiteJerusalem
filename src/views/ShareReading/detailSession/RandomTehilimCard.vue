<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../../../components/icons/AppIcon.vue";

/**
 * L'entrée la plus courte dans une chaîne de Tehilim : un bouton, et le
 * lecteur se retrouve sur un chapitre libre, déjà réservé à son nom. Purement
 * présentationnel : le tirage lui-même reste à la page de la chaîne.
 */

defineProps<{
  availableCount: number;
}>();

const emit = defineEmits<{
  (e: "draw"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="card p-5 mb-8 max-w-3xl mx-auto text-center">
    <h3 class="font-bold text-lg text-text-primary">
      {{ t("detailSession.randomDraw.title") }}
    </h3>
    <p class="text-sm text-text-secondary mt-0.5 mb-4">
      {{ t("detailSession.randomDraw.subtitle") }}
    </p>
    <!-- Aucun état de chargement : le clic ouvre la lecture sans attendre, la
         réservation se pose là-bas. -->
    <button @click="emit('draw')" class="btn btn-primary" :disabled="availableCount === 0">
      <AppIcon name="shuffle" :size="16" />
      {{ t("detailSession.randomDraw.button") }}
    </button>
    <p v-if="availableCount === 0" class="text-sm text-text-secondary mt-3">
      {{ t("detailSession.randomDraw.noneAvailable") }}
    </p>
  </div>
</template>
