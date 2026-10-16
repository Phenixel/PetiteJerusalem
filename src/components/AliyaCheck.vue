<script setup lang="ts">
import AppIcon from "./icons/AppIcon.vue";

/**
 * La case d'une montée du chnei mikra : une pastille qui porte son nom,
 * cochée à la couleur du thème. Dans le texte, à côté du titre de la montée
 * (« Marquer lue », puis « Lue ») ; dans la liste de la semaine, avec le nom
 * de la montée (« Lévi »).
 */

defineProps<{
  checked: boolean;
  /** Ce que la pastille dit. */
  label: string;
  /** Ce que lit un lecteur d'écran (« 2e montée lue »). */
  spoken: string;
}>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    class="aliya-check"
    :class="{ 'aliya-check-done': checked }"
    role="checkbox"
    :aria-checked="checked"
    :aria-label="spoken"
    @click="emit('toggle')"
  >
    <span class="aliya-box" aria-hidden="true">
      <AppIcon v-if="checked" name="check" :size="12" />
    </span>
    <span class="min-w-0 truncate">{{ label }}</span>
  </button>
</template>

<style scoped>
.aliya-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px 0 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.aliya-box {
  display: grid;
  flex: none;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 5px;
  border: 2px solid currentColor;
}
.aliya-check-done {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
}
.aliya-check-done .aliya-box {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-surface);
}
</style>
