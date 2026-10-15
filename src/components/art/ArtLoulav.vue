<script setup lang="ts">
/**
 * Le loulav et l'etrog, dans 100 × 150 : la palme au milieu, fermée, sa
 * nervure claire ; la arava (le saule) à gauche, ses feuilles longues et
 * pâles sur leur tige rouge ; le hadass (le myrte) à droite, ses petites
 * feuilles sombres trois par trois ; le lien de palme tressée qui les tient ;
 * et devant, l'etrog, sa pitam en haut.
 */
const ARAVA = [
  { x: 37, y: 46, rot: -10 },
  { x: 35.5, y: 56, rot: -24 },
  { x: 40.5, y: 64, rot: 22 },
  { x: 36, y: 74, rot: -26 },
  { x: 41.5, y: 82, rot: 22 },
];

const HADASS = [48, 56, 64, 72, 80].map((y, i) => ({ x: 66 - i * 0.8, y }));
</script>

<template>
  <svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg">
    <!-- La arava : la tige rouge, les feuilles en lame. -->
    <path d="M42 150Q39 100 37 40" class="arava-stem" />
    <ellipse
      v-for="(leaf, i) in ARAVA"
      :key="`a${i}`"
      :cx="leaf.x"
      :cy="leaf.y"
      rx="2.2"
      ry="10"
      :transform="`rotate(${leaf.rot} ${leaf.x} ${leaf.y})`"
      class="arava"
    />

    <!-- Le hadass : la tige, les feuilles par trois. -->
    <path d="M59 150Q63 100 66 44" class="hadass-stem" />
    <g v-for="(node, i) in HADASS" :key="`h${i}`">
      <ellipse
        :cx="node.x - 3.4"
        :cy="node.y + 1"
        rx="2.9"
        ry="5.2"
        :transform="`rotate(-38 ${node.x - 3.4} ${node.y + 1})`"
        class="hadass"
      />
      <ellipse
        :cx="node.x + 3.4"
        :cy="node.y + 1"
        rx="2.9"
        ry="5.2"
        :transform="`rotate(38 ${node.x + 3.4} ${node.y + 1})`"
        class="hadass"
      />
      <ellipse :cx="node.x" :cy="node.y - 3" rx="2.7" ry="5" class="hadass-front" />
    </g>

    <!-- La palme, fermée, et sa nervure. -->
    <path d="M50 1C57 22 58 80 58 150H42C42 80 43 22 50 1Z" class="palm" />
    <path d="M54.5 36C57 80 57.5 110 57.5 150H50.5C51 110 52.5 70 54.5 36Z" class="palm-shade" />
    <path d="M50 8V150" class="palm-rib" />

    <!-- Le lien de palme tressée. -->
    <rect x="39.5" y="90" width="22" height="11" rx="2" class="band" />
    <path d="M43 90L47 101M48.5 90L52.5 101M54 90L58 101" class="band-weave" />

    <!-- L'etrog, devant, sa pitam vers le haut. -->
    <g transform="translate(74 104) rotate(26) scale(1.15)">
      <path
        d="M0 -15C9 -14 14 -4 13 4C12 12 6 15 0 15C-6 15 -12 12 -13 4C-14 -4 -9 -14 0 -15Z"
        class="etrog"
      />
      <path d="M13 4C12 12 6 15 0 15C-6 15 -10 12 -12 7C-5 11 6 10 13 4Z" class="etrog-shade" />
      <ellipse cx="-5" cy="-6" rx="3.5" ry="5" class="etrog-light" />
      <rect x="-0.7" y="-19" width="1.4" height="4" class="pitam" />
      <circle cx="0" cy="-19.5" r="1.4" class="pitam" />
    </g>
  </svg>
</template>

<style scoped>
/* Les couleurs de l'objet : quatre verts, la paille du lien, le jaune de
   l'etrog. */
.arava-stem {
  fill: none;
  stroke: #8b4a3a;
  stroke-width: 1.3;
}
.arava {
  fill: #a3c06d;
}
.hadass-stem {
  fill: none;
  stroke: #3a4a28;
  stroke-width: 1.3;
}
.hadass {
  fill: #24491f;
}
.hadass-front {
  fill: #2f5a27;
}
.palm {
  fill: #2f5d1f;
}
.palm-shade {
  fill: #234a17;
}
.palm-rib {
  stroke: #79a34a;
  stroke-width: 1.1;
}
.band {
  fill: #c89c5c;
}
.band-weave {
  stroke: #9a723a;
  stroke-width: 1;
}
.etrog {
  fill: #ecc534;
}
.etrog-shade {
  fill: #d2a920;
}
.etrog-light {
  fill: #f7df70;
}
.pitam {
  fill: #6e5426;
}
</style>
