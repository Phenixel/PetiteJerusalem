<script setup lang="ts">
/**
 * Le chofar, dans 100 × 140 : une corne de bélier dont le pavillon descend
 * sous le bord de la carte, qui monte en s'incurvant jusqu'à l'embouchure,
 * en haut. Ivoire et miel, ses anneaux en travers, la pointe plus sombre.
 */
import { useId } from "vue";

const id = useId();

const HORN =
  "M94 142C97 98 83 54 53 27C41 16 31 10 20 9Q13 11 18 16C29 16 39 23 48 33C70 56 73 99 62 142Z";
</script>

<template>
  <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath :id="`${id}-horn`">
        <path :d="HORN" />
      </clipPath>
    </defs>
    <path :d="HORN" class="horn" />
    <g :clip-path="`url(#${id}-horn)`">
      <!-- Le flanc intérieur de la courbe, dans l'ombre. -->
      <path
        d="M18 16C29 16 39 23 48 33C70 56 73 99 62 142H73C82 100 76 57 54 34C43 23 31 15 18 16Z"
        class="horn-shade"
      />
      <!-- Le dos de la courbe, que la lumière prend. -->
      <path d="M94 142C97 98 83 54 53 27L56 31C84 58 92 98 89 142Z" class="horn-light" />
      <!-- Les anneaux de la corne. -->
      <path
        d="M60 126Q77 120 96 125M62 106Q76 98 93 101M60 86Q71 76 86 77M54 66Q62 56 76 55M46 47Q52 38 63 37M37 33Q41 26 50 24"
        class="rings"
      />
      <!-- La pointe, polie et plus sombre. -->
      <path d="M30 9C24 8 17 9 14 12C13 15 16 17 21 16C25 15 28 14 31 15Z" class="tip" />
    </g>
  </svg>
</template>

<style scoped>
/* Les couleurs de l'objet : la corne, du miel à l'ivoire. */
.horn {
  fill: #e6cf9f;
}
.horn-shade {
  fill: #c9a66a;
}
.horn-light {
  fill: #f2e4c2;
}
.rings {
  fill: none;
  stroke: #b38749;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.tip {
  fill: #74512c;
}
</style>
