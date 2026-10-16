<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * Le signet d'un livre, posé juste avant le verset marqué : le ruban de soie
 * rouge des volumes dessinés de l'app (ArtVolume, ArtSiddur), couché sur la
 * page. Il sort de la reliure, à droite (le dos d'un livre hébreu), court
 * sur quelques centimètres au-dessus du début du verset et finit en queue
 * d'aronde, le bout fendu qui dit « marque-page ». Le pli, plus sombre, est
 * là où il sort de la page ; un filet clair dit la soie.
 *
 * Un `span` en bloc : il se pose aussi dans un paragraphe (la guemara, la
 * lecture du jour), où il ouvre une ligne avant le passage marqué.
 */
const { t } = useI18n();
</script>

<template>
  <span class="bookmark-ribbon" role="img" :aria-label="t('textReading.selection.bookmark')">
    <svg viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden="true">
      <!-- Le ruban, la queue d'aronde à gauche. -->
      <path class="ribbon" d="M120 1.5H3L11 7 3 12.5H120Z" />
      <!-- Le pli, là où il sort de la reliure. -->
      <rect class="fold" x="110" y="1.5" width="10" height="11" />
      <!-- Le reflet de la soie. -->
      <path class="sheen" d="M13 4.2H108" />
    </svg>
  </span>
</template>

<style scoped>
.bookmark-ribbon {
  display: block;
  width: 8rem;
  height: 0.95rem;
  /* Il part du bord droit, et en dépasse un peu : il sort de la reliure. */
  margin: 0.3rem -0.5rem 0.55rem auto;
  filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.22));
}

.bookmark-ribbon svg {
  display: block;
  width: 100%;
  height: 100%;
}

.ribbon {
  fill: var(--color-ribbon);
}

.fold {
  fill: #000;
  opacity: 0.22;
}

.sheen {
  stroke: #fff;
  stroke-width: 0.9;
  opacity: 0.28;
  fill: none;
}
</style>
