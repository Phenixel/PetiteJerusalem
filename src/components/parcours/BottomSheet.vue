<script setup lang="ts">
/**
 * La feuille du bas de Mon parcours : la fiche d'une carte, un jour du mur,
 * le rattrapage. Elle monte du pied de l'écran, avec sa poignée ; le voile ou
 * Échap la referment (AppModal fait le reste : clavier, retour Android,
 * défilement bloqué derrière).
 *
 * `tall`, pour une feuille plus haute que l'écran (Mes lumières) : elle
 * s'ouvre à mi-hauteur, son début sous les yeux ; glissée vers le haut, elle
 * se déploie jusqu'en haut de l'écran, puis son contenu défile. Sans lui,
 * elle s'ouvrait tout en haut, déjà déployée.
 */
import AppModal from "../AppModal.vue";

withDefaults(defineProps<{ open: boolean; label?: string; tall?: boolean }>(), { tall: false });
const emit = defineEmits<{ (e: "close"): void }>();
</script>

<template>
  <AppModal
    :open="open"
    :label="label"
    overlay-class="sheet-overlay"
    :panel-class="tall ? 'sheet-panel sheet-panel-tall' : 'sheet-panel'"
    @close="emit('close')"
  >
    <div class="mx-auto mb-4 h-1 w-10 rounded-pill bg-line-strong" aria-hidden="true" />
    <slot />
  </AppModal>
</template>
