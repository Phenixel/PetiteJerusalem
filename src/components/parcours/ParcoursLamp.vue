<script lang="ts">
/** La hauteur de la flamme. */
export type LampLevel = "low" | "normal" | "high";
</script>

<script setup lang="ts">
/**
 * La lampe de Mon parcours : un nèr de terre cuite, comme ceux qu'on trouve
 * au pied des murailles de Jérusalem, tel que la maquette le dessine
 * (P2-Accueil, P2-Parcours). Sa flamme dit la série, des jours d'affilée où
 * l'on a fait quelque chose : elle monte quand la journée est pleine, et
 * baisse un jour manqué sans jamais s'éteindre. Pas de reproche.
 *
 * Un objet, aux couleurs du vrai et en aplats (voir CardArt) : elle ne suit
 * pas le thème. Elle ne vacille pas d'elle-même : rien ne bouge sans geste.
 */
import { computed } from "vue";

const props = withDefaults(defineProps<{ level?: LampLevel; width?: number }>(), {
  level: "normal",
  width: 76,
});

/** La taille de la flamme : basse un jour manqué, haute une journée pleine. */
const FLAME: Record<LampLevel, number> = { low: 0.7, normal: 1, high: 1.15 };
const flame = computed(() => ({ transform: `scale(${FLAME[props.level]})` }));
</script>

<template>
  <svg
    :width="width"
    :height="(width * 62) / 80"
    viewBox="0 0 80 62"
    aria-hidden="true"
    class="parcours-lamp"
  >
    <!-- L'ombre, posée sous la lampe. -->
    <ellipse cx="38" cy="57" rx="26" ry="3" class="shadow" />
    <!-- La flamme, au-dessus du bec, et sa mèche. -->
    <g class="flame" :style="flame">
      <path d="M62 4C66 12 70 18 70 24A8 8 0 0 1 54 24C54 18 58 12 62 4Z" fill="#f2a541" />
      <path d="M62 13C64 17 66 20.5 66 24A4 4 0 0 1 58 24C58 20.5 60 17 62 13Z" fill="#fde6b0" />
    </g>
    <rect x="61" y="30" width="2" height="4" rx="1" fill="#3b2412" />
    <!-- Le corps, le bec qui s'allonge vers la droite, l'ouverture où l'on
         verse l'huile, un reflet, et l'anse. -->
    <path
      d="M10 45C10 50 16 53 27 53C34 53 40 51 44 46L58 45C64 44.5 67 42.5 67 40L67 41.5C67 44.5 63 47 57 47.5L45 48.5C41 53.5 34.5 55.5 27 55.5C15.5 55.5 10 51 10 45Z"
      fill="#8e4a2a"
    />
    <path
      d="M10 45C10 37 18 33 32 33L58 35C64 35.5 67 37.5 67 40C67 42.5 64 44.5 58 45L44 46C40 51 34 53 27 53C16 53 10 50 10 45Z"
      fill="#b9683f"
    />
    <ellipse cx="29" cy="37" rx="6" ry="1.8" fill="#6f3a20" />
    <path
      d="M18 40C22 37.5 29 37 35 37.5"
      stroke="#d58a5f"
      stroke-width="1.5"
      fill="none"
      stroke-linecap="round"
    />
    <path
      d="M11 43C5 41 5 35 10 34"
      stroke="#9a5532"
      stroke-width="3"
      fill="none"
      stroke-linecap="round"
    />
  </svg>
</template>

<style scoped>
.shadow {
  fill: rgb(58 46 30 / 0.16);
}
:root.dark .shadow {
  fill: rgb(0 0 0 / 0.3);
}
/* La flamme grandit ou baisse depuis sa mèche. */
.flame {
  transform-box: view-box;
  transform-origin: 62px 31px;
  transition: transform 0.4s ease;
}
@media (prefers-reduced-motion: reduce) {
  .flame {
    transition: none;
  }
}
</style>
