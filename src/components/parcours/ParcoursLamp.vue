<script setup lang="ts">
/**
 * La lampe de Mon parcours : un nèr de terre cuite, comme ceux qu'on trouve
 * au pied des murailles de Jérusalem. Sa flamme brûle tant que la série tient
 * (des jours d'affilée où l'on a fait quelque chose) ; éteinte, la lampe
 * attend, sans reproche.
 *
 * Un objet, aux couleurs du vrai et en aplats (voir CardArt) : elle ne suit
 * pas le thème. Elle ne vacille pas d'elle-même : rien ne bouge sans geste.
 */
withDefaults(defineProps<{ lit: boolean; size?: number }>(), { size: 96 });
</script>

<template>
  <svg
    :width="size"
    :height="(size * 72) / 96"
    viewBox="0 0 96 72"
    aria-hidden="true"
    class="parcours-lamp"
  >
    <!-- L'ombre, posée sous la lampe. -->
    <ellipse cx="44" cy="66" rx="30" ry="3.5" class="shadow" />
    <!-- L'anse, puis le corps, le bec qui s'allonge vers la droite. -->
    <path d="M14 46c-9-2-11-14-2-16 4-1 7 1 8 4" class="clay-dark" fill="none" stroke-width="5" />
    <path
      d="M16 44c0-11 12-17 28-17s26 5 34 9l10 3c3 1 3 5 0 6l-12 4c-9 6-20 10-32 10-16 0-28-5-28-15z"
      class="clay"
    />
    <path
      d="M18 50c6 6 16 8 26 8 12 0 22-4 31-10l3 1c-9 7-20 11-34 11-12 0-22-3-26-10z"
      class="clay-dark"
    />
    <!-- L'ouverture où l'on verse l'huile. -->
    <ellipse cx="42" cy="34" rx="9" ry="3.2" class="hole" />
    <!-- La flamme, au bout du bec. -->
    <g v-if="lit">
      <path d="M86 38c-5-6-4-13 1-22 2 6 8 11 6 17-1 3-4 5-7 5z" class="flame" />
      <path d="M87 37c-2-3-2-7 0-11 2 4 4 6 3 9-1 1-2 2-3 2z" class="flame-heart" />
    </g>
    <circle v-else cx="88" cy="39" r="1.6" class="wick" />
  </svg>
</template>

<style scoped>
.shadow {
  fill: rgb(58 46 30 / 0.12);
}
.clay {
  fill: #b9653b;
}
.clay-dark {
  fill: #8f4a2a;
  stroke: #8f4a2a;
}
.hole {
  fill: #6b3720;
}
.flame {
  fill: #fea547;
}
.flame-heart {
  fill: #ffe08a;
}
.wick {
  fill: #4a2a18;
}
:root.dark .shadow {
  fill: rgb(0 0 0 / 0.3);
}
</style>
