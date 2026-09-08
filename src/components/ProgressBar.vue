<script setup lang="ts">
import { computed } from "vue";

/**
 * Une bande de progression, la même partout : cartes de chaîne, lecture du
 * jour, lecteur audio, envoi d'un fichier.
 *
 * Le remplissage est un `transform: scaleX`, pas une largeur : une largeur
 * animée relance mise en page et peinture à chaque étape (et à chaque frame
 * pendant qu'un morceau se lit), la transformation reste sur le compositeur.
 * `origin-left` avec son miroir `rtl:` : la bande part du début de la ligne
 * dans les deux sens d'écriture.
 *
 * `value` est un pourcentage (0 à 100) ; `tone` choisit la couleur de
 * remplissage, `size` la hauteur. `animated` (défaut) adoucit chaque
 * changement ; à couper pour une valeur qui bouge en continu (lecture audio).
 */
const props = withDefaults(
  defineProps<{
    value: number;
    tone?: "primary" | "success" | "info" | "muted";
    size?: "xs" | "sm" | "md";
    animated?: boolean;
    label?: string;
  }>(),
  { tone: "primary", size: "sm", animated: true, label: undefined },
);

const TONES: Record<NonNullable<typeof props.tone>, string> = {
  primary: "bg-primary",
  success: "bg-green-500",
  info: "bg-blue-500",
  muted: "bg-text-secondary/60",
};
const SIZES: Record<NonNullable<typeof props.size>, string> = {
  xs: "h-1",
  sm: "h-2",
  md: "h-3",
};

const ratio = computed(() => Math.min(1, Math.max(0, (props.value || 0) / 100)));
</script>

<template>
  <div
    class="w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
    :class="SIZES[size]"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="Math.round(ratio * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      class="h-full w-full origin-left rounded-full rtl:origin-right"
      :class="[TONES[tone], animated ? 'transition-transform duration-500 ease-out' : '']"
      :style="{ transform: `scaleX(${ratio})` }"
    ></div>
  </div>
</template>
