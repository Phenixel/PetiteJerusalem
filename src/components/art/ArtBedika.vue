<script setup lang="ts">
/**
 * The search for 'hamets (bedikat 'hamets), in 100 × 120: the lit candle,
 * the feather and the wooden spoon, leaning against one another. Flat
 * colors, no gradient, like the other objects of the cards.
 */
</script>

<template>
  <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
    <!-- The wooden spoon, at the back. -->
    <g transform="rotate(14 70 70)">
      <ellipse cx="72" cy="34" rx="10.5" ry="14.5" class="wood" />
      <ellipse cx="72" cy="32" rx="7" ry="10" class="wood-shade" />
      <rect x="69.4" y="47" width="5.2" height="70" rx="2.6" class="wood" />
      <rect x="72" y="47" width="2.6" height="70" class="wood-shade" />
    </g>

    <!-- The candle, lit. -->
    <g transform="rotate(-16 30 80)">
      <rect x="22" y="44" width="12" height="74" rx="2" class="wax" />
      <rect x="29" y="44" width="5" height="74" class="wax-side" />
      <path d="M28 44v-5" class="wick" />
      <path
        d="M28 14c7 8 9.4 13 8.2 17.6s-4.4 7-8.2 7-7-2.4-8.2-7 1.2-9.6 8.2-17.6z"
        class="flame"
      />
      <path
        d="M28 21c4 4.6 5.8 8.2 4.6 11s-2.4 4-4.6 4-3.8-1.2-4.6-4 0.6-6.4 4.6-11z"
        class="flame-in"
      />
      <ellipse cx="28" cy="32" rx="2" ry="2.8" class="flame-core" />
    </g>

    <!-- The feather, in front. -->
    <g transform="rotate(30 50 80)">
      <path
        d="M48 118C44 98 42 80 46 60C48 51 52 44 57 39C61 51 61 67 57 85C55 98 51 109 48 118Z"
        class="feather"
      />
      <path d="M48 118C49 95 51 70 57 39" class="quill" />
      <path
        d="M50 76l-5 -3M51 67l-5 -4M53 58l-4 -4M49 87l-4 -2M52 74l5 -3M54 64l4 -4M55 55l3 -4"
        class="barbs"
      />
    </g>
  </svg>
</template>

<style scoped>
.wood {
  fill: #c08a52;
}
.wood-shade {
  fill: #a46f3c;
}
.wax {
  fill: #f6f1e6;
}
.wax-side {
  fill: #e6dccb;
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
.feather {
  fill: #efe4cf;
}
.quill {
  fill: none;
  stroke: #b9a681;
  stroke-width: 1.5;
  stroke-linecap: round;
}
.barbs {
  fill: none;
  stroke: #d6c7a8;
  stroke-width: 1.2;
  stroke-linecap: round;
}
</style>
