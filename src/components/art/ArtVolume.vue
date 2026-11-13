<script setup lang="ts">
/**
 * Un volume d'étude, dans 100 × 130 : le même livre que le sidour (le plat,
 * la tranche, le signet), mais relié à la teinte de son corpus et titré de
 * son nom, en lettres dorées. C'est l'objet des cartes de programme : le
 * séder Moed, les Tehilim, le traité qu'on s'est donné à finir.
 *
 * La reliure est passée en propriété (voir config/bindings.ts) ; l'ombre du
 * dos et le plat arrière en sont des voiles sombres, en aplats.
 */
defineProps<{
  /** La reliure. */
  color: string;
  /** Le titre de la couverture, court : « Moed », « Avot ». */
  label: string;
}>();
</script>

<template>
  <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-9 52 66)">
      <rect x="25" y="17" width="68" height="102" rx="3" :fill="color" class="cover" />
      <rect x="25" y="17" width="68" height="102" rx="3" class="shade" />
      <rect x="24" y="15.5" width="66" height="101" rx="1.5" class="pages" />
      <path d="M86.5 18V114M88.2 18V114" class="leaves" />
      <path d="M62 112H68V132L65 128.5L62 132Z" class="ribbon" />
      <rect x="17" y="12" width="68" height="102" rx="3" :fill="color" class="cover" />
      <rect x="17" y="12" width="9" height="102" rx="3" class="spine" />
      <rect x="32" y="24" width="45" height="78" rx="1.5" class="gold-line" />
      <text x="54.5" y="58" text-anchor="middle" class="title">{{ label }}</text>
      <path d="M44 70H65" class="gold-line" />
    </g>
  </svg>
</template>

<style scoped>
.cover {
  stroke: var(--art-outline, none);
  stroke-width: 0.9;
}
.shade {
  fill: #000;
  opacity: 0.22;
}
.spine {
  fill: #000;
  opacity: 0.16;
}
.pages {
  fill: #f2e9d4;
}
.leaves {
  stroke: #d9caa6;
  stroke-width: 0.6;
  fill: none;
}
.ribbon {
  fill: #b3262f;
}
.gold-line {
  fill: none;
  stroke: #e2c06a;
  stroke-width: 1.1;
}
.title {
  fill: #f3ead6;
  font-family: var(--font-serif), serif;
  font-size: 12px;
  font-weight: 600;
}
</style>
