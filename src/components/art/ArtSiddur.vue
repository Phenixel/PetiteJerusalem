<script setup lang="ts">
/**
 * Le sidour, dans 100 × 130 : un livre relié, couverture de cuir bleu nuit,
 * titre et filets dorés, la tranche des pages sur le côté et le signet rouge
 * qui pend. Il penche un peu, comme posé contre quelque chose.
 */
</script>

<template>
  <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-9 52 66)">
      <!-- Le plat arrière, puis le bloc des pages qui dépasse sur le côté et
           en bas, ses feuillets en traits fins. -->
      <rect x="25" y="17" width="68" height="102" rx="3" class="cover-back" />
      <rect x="24" y="15.5" width="66" height="101" rx="1.5" class="pages" />
      <path d="M86.5 18V114M88.2 18V114" class="leaves" />
      <!-- Le signet, sorti par le bas. -->
      <path d="M62 112H68V132L65 128.5L62 132Z" class="ribbon" />
      <!-- Le plat avant, le dos arrondi plus clair. -->
      <rect x="17" y="12" width="68" height="102" rx="3" class="cover" />
      <rect x="17" y="12" width="9" height="102" rx="3" class="spine" />
      <path d="M26 12.5V113.5" class="spine-line" />
      <!-- Les filets et le titre, dorés à chaud. -->
      <rect x="32" y="24" width="45" height="78" rx="1.5" class="gold-line" />
      <rect x="35" y="27" width="39" height="72" rx="1" class="gold-line gold-thin" />
      <text x="54.5" y="57" text-anchor="middle" class="title">סידור</text>
      <path d="M54.5 66L57.5 70L54.5 74L51.5 70Z" class="gold" />
      <path d="M44 70H49.5M59.5 70H65" class="gold-line" />
    </g>
  </svg>
</template>

<style scoped>
/* Les couleurs de l'objet : le cuir, le papier, la dorure. */
.cover {
  fill: #1c3157;
}
.cover-back {
  fill: #13223d;
}
.spine {
  fill: #27426f;
}
.spine-line {
  stroke: #142541;
  stroke-width: 0.8;
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
.gold {
  fill: #d6b156;
}
.gold-line {
  fill: none;
  stroke: #d6b156;
  stroke-width: 1.1;
}
.gold-thin {
  stroke-width: 0.5;
}
.title {
  fill: #dcb85e;
  font-family: var(--font-hebrew), serif;
  font-size: 12.5px;
  font-weight: 700;
}
</style>
