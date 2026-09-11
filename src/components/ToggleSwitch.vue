<script setup lang="ts">
/**
 * L'interrupteur des réglages : la case à cocher du navigateur, habillée.
 *
 * Un seul endroit pour son dessin. Il était recopié à sept exemplaires, avec
 * la même longue suite de classes : la moindre retouche du rayon ou de la
 * couleur en oubliait forcément un.
 *
 * Il est COMMANDÉ, pas autonome : il affiche ce que le parent lui donne et
 * annonce le geste, à charge pour le parent de changer la valeur. C'est ce que
 * demandent les réglages qui peuvent refuser (le rappel du Chabbat, sans la
 * permission du système). La case du navigateur, elle, bascule d'elle-même au
 * clic : on la remet donc dans l'état que le parent tient, sinon elle
 * mentirait jusqu'au rendu suivant, qui peut ne jamais venir.
 */
import { nextTick } from "vue";

const props = defineProps<{
  modelValue: boolean;
  /** Étiquette pour les lecteurs d'écran, quand aucun texte ne l'accompagne. */
  label?: string;
}>();

const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  emit("update:modelValue", input.checked);
  void nextTick(() => {
    input.checked = props.modelValue;
  });
}
</script>

<template>
  <span class="relative inline-flex shrink-0 items-center">
    <input
      type="checkbox"
      class="sr-only peer"
      :checked="modelValue"
      :aria-label="label"
      @change="onChange"
    />
    <span
      class="w-10 h-5 bg-black/15 peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-all peer-checked:bg-primary dark:bg-white/20"
    ></span>
  </span>
</template>
