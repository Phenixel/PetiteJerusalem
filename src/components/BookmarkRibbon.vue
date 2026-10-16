<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * Le signet d'un livre, posé juste avant le verset marqué : un ruban de soie
 * rouge en travers de la page, dont le bout fendu pend dans la marge, du
 * côté de la tranche, comme celui d'un vrai livre. On le retrouve d'un coup
 * d'œil en faisant défiler.
 *
 * Un `span` en bloc : il se pose aussi dans un paragraphe (la guemara, la
 * lecture du jour), où il ouvre une ligne avant le passage marqué.
 */
const { t } = useI18n();
</script>

<template>
  <span class="bookmark-ribbon" role="img" :aria-label="t('textReading.selection.bookmark')" />
</template>

<style scoped>
.bookmark-ribbon {
  position: relative;
  display: block;
  height: 5px;
  margin: 0.35rem -0.5rem 0.65rem;
  border-radius: 1px;
  background-color: var(--color-ribbon);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.18);
}

/* Le bout du ruban : il sort de la page, pend dans la marge à gauche (la
   tranche d'un livre hébreu) et finit en queue d'aronde. */
.bookmark-ribbon::after {
  content: "";
  position: absolute;
  top: 0;
  left: -0.6rem;
  width: 0.6rem;
  height: 1.9rem;
  background-color: var(--color-ribbon);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
}
</style>
