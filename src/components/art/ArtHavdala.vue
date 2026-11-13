<script setup lang="ts">
/**
 * The havdala, in 100 × 130: the braided candle, its strands of blue and
 * white crossing up the column, several wicks under a single flame (a
 * torch, as the blessing over fire asks), and beside it the cup of wine, in
 * silver. Flat colors, no gradient, like the other objects of the cards.
 */
const TOP = 30;
const BOTTOM = 126;
const LEFT = 58;
const RIGHT = 84;

/** The braid: one strand climbs to the right, the other to the left, every 10. */
const ROWS = Array.from({ length: 9 }, (_, i) => TOP + i * 10);
const strand = (y: number, rising: boolean): string =>
  rising
    ? `M${LEFT} ${y}L${RIGHT} ${y + 10}L${RIGHT} ${y + 16}L${LEFT} ${y + 6}Z`
    : `M${RIGHT} ${y + 5}L${LEFT} ${y + 15}L${LEFT} ${y + 21}L${RIGHT} ${y + 11}Z`;
const inside = (y: number): boolean => y + 21 <= BOTTOM;
</script>

<template>
  <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">
    <!-- The cup of wine. -->
    <path d="M17 122C17 116 24 112 29 112C34 112 41 116 41 122Z" class="silver-shade" />
    <ellipse cx="29" cy="122" rx="12" ry="2.6" class="silver" />
    <path d="M27 92H31V112H27Z" class="silver" />
    <ellipse cx="29" cy="101" rx="4.2" ry="2" class="silver-shade" />
    <path d="M12 62H46C46 80 40 92 29 92C18 92 12 80 12 62Z" class="silver" />
    <path d="M29 62H46C46 80 40 92 29 92Z" class="silver-shade" />
    <ellipse cx="29" cy="62" rx="17" ry="3.4" class="silver-light" />
    <ellipse cx="29" cy="63" rx="14.5" ry="2.4" class="wine" />
    <path d="M17 67C17.5 76 20.5 84 25 88" class="shine" />

    <!-- The braided candle. -->
    <rect
      :x="LEFT"
      :y="TOP - 2"
      :width="RIGHT - LEFT"
      :height="BOTTOM - TOP + 2"
      rx="4"
      class="wax"
    />
    <path
      v-for="y in ROWS.filter(inside)"
      :key="`w${y}`"
      :d="strand(y, false)"
      class="strand-light"
    />
    <path v-for="y in ROWS.filter(inside)" :key="`b${y}`" :d="strand(y, true)" class="strand" />

    <!-- The wicks, and the single flame over them. -->
    <path d="M64 28V22M71 28V20M78 28V22" class="wick" />
    <path
      d="M71 1C80 9 84 15 83 20C82 25 77 27 71 27C65 27 60 25 59 20C58 15 62 9 71 1Z"
      class="flame"
    />
    <path
      d="M71 9C76 14 78 18 77 21C76 24 74 25 71 25C68 25 66 24 65 21C64 18 66 14 71 9Z"
      class="flame-in"
    />
    <ellipse cx="71" cy="21.5" rx="2.6" ry="3.4" class="flame-core" />
  </svg>
</template>

<style scoped>
/* The colors of the object: silver, red wine, white wax and blue strands. */
.silver {
  fill: #cdd0d6;
}
.silver-shade {
  fill: #a8acb4;
}
.silver-light {
  fill: #eceef1;
}
.wine {
  fill: #8e2440;
}
.shine {
  fill: none;
  stroke: #f4f5f7;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.wax {
  fill: #f1e9db;
}
.strand-light {
  fill: #9fbbe3;
}
.strand {
  fill: #2f5ea8;
}
.wick {
  fill: none;
  stroke: #3b2f26;
  stroke-width: 1.4;
  stroke-linecap: round;
}
.flame {
  fill: #f39233;
}
.flame-in {
  fill: #ffcf5c;
}
.flame-core {
  fill: #fff4d2;
}
</style>
