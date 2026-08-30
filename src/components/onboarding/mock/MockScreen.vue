<script setup lang="ts">
/**
 * Le cadre commun des captures de l'introduction : un morceau
 * d'application en réduction, posé sur le fond de l'app.
 *
 * Elles sont dessinées, pas photographiées : elles suivent le thème de
 * couleurs choisi et le mode sombre, elles parlent la langue affichée, et
 * elles ne vieillissent pas d'une refonte à l'autre comme le ferait une image.
 */
withDefaults(defineProps<{ height?: string }>(), { height: "10rem" });
</script>

<template>
  <div class="capture" :style="{ height }" aria-hidden="true">
    <slot />
  </div>
</template>

<style scoped>
.capture {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  background-color: var(--color-bg-beige);
  box-shadow:
    inset 0 0 0 1px var(--color-line),
    var(--shadow-card);
}

:root.dark .capture {
  background-color: #111827;
}
</style>
