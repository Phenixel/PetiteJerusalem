<script setup lang="ts">
/**
 * Un choix parmi d'autres, en pastille : la couleur du thème quand il est
 * pris. Une commande, donc ronde (docs/design.md, « Les rayons »). Sans
 * `on`, c'est un simple bouton qui mène plus loin.
 */
// Sans valeur par défaut explicite, Vue lirait un `on` absent comme `false`.
withDefaults(defineProps<{ on?: boolean }>(), { on: undefined });
</script>

<template>
  <button
    type="button"
    class="inline-flex min-h-10 items-center rounded-pill px-4 text-sm font-bold transition-colors"
    :class="
      on ? 'bg-brand text-on-brand' : 'bg-text-primary/5 text-text-primary hover:bg-text-primary/10'
    "
    :aria-pressed="on === undefined ? undefined : on"
  >
    <slot />
  </button>
</template>
