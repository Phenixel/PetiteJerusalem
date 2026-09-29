<script setup lang="ts">
import AppIcon from "../icons/AppIcon.vue";
import type { IconName } from "../icons/registry";

/**
 * Une pastille d'état du backoffice (publié, brouillon, masquée, incident en
 * cours…). Cinq tons, toujours les mêmes d'une page à l'autre : vert pour ce
 * qui est en ligne, ambre pour ce qui attend une décision, rouge pour ce qui
 * est retiré, la couleur du thème pour une nature, gris pour un détail.
 */
export type AdminTone = "success" | "warning" | "danger" | "primary" | "neutral";

defineProps<{ tone: AdminTone; label: string; icon?: IconName }>();

const TONES: Record<AdminTone, string> = {
  success: "bg-green-600/10 text-green-700 dark:text-green-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-red-600/10 text-red-700 dark:text-red-300",
  primary: "bg-primary/10 text-primary",
  neutral: "bg-black/5 text-text-secondary dark:bg-white/10",
};
</script>

<template>
  <span class="chip" :class="TONES[tone]">
    <AppIcon v-if="icon" :name="icon" :size="12" />
    {{ label }}
  </span>
</template>
