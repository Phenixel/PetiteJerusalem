<script setup lang="ts">
/**
 * La feuille du bas de Mon parcours : la fiche d'une carte, un jour du mur,
 * le rattrapage. Elle monte du pied de l'écran, avec sa poignée ; le voile ou
 * Échap la referment (AppModal fait le reste : clavier, retour Android,
 * défilement bloqué derrière).
 */
import AppModal from "../AppModal.vue";

defineProps<{ open: boolean; label?: string }>();
const emit = defineEmits<{ (e: "close"): void }>();
</script>

<template>
  <AppModal
    :open="open"
    :label="label"
    overlay-class="sheet-overlay"
    panel-class="sheet-panel"
    @close="emit('close')"
  >
    <div class="mx-auto mb-4 h-1 w-10 rounded-pill bg-line-strong" aria-hidden="true" />
    <slot />
  </AppModal>
</template>
