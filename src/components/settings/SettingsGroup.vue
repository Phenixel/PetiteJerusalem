<script setup lang="ts">
/**
 * Un groupe de lignes des réglages de l'app : un titre en petit, puis un
 * panneau où les lignes (SettingsRow) se suivent, séparées d'un filet.
 *
 * Le panneau est une surface, pas une carte cliquable : il ne prend pas
 * `card-hover`, ce sont ses lignes qui se touchent. Elles vont d'un bord à
 * l'autre sans marge : le panneau coupe leurs angles (`overflow-hidden`), et
 * leur fond d'appui épouse ainsi les siens (voir docs/design.md, « Deux
 * arrondis emboîtés ne sont jamais égaux » : sans marge, le rayon est le même).
 *
 * Le titre s'écrit en bas de casse, au corps d'un texte secondaire (« Mon
 * compte », pas « MON COMPTE »).
 */
defineProps<{ title: string }>();
</script>

<template>
  <section>
    <h2 class="mb-2 px-1 text-sm font-semibold text-text-secondary">{{ title }}</h2>
    <ul class="card flex flex-col divide-y divide-line overflow-hidden">
      <slot />
    </ul>
  </section>
</template>
