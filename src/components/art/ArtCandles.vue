<script setup lang="ts">
/**
 * The two Chabbat candles, in 100 × 130: white candles in silver
 * candlesticks, lit. Flat colors, no gradient, like the other objects of the
 * cards; the silver and the flame are those of the havdala (ArtHavdala).
 */
const CANDLES = [28, 72];
</script>

<template>
  <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">
    <g v-for="x in CANDLES" :key="x">
      <!-- The candlestick: its foot, its stem, its cup. -->
      <path :d="`M${x - 14} 128h28l-4 -7h-20z`" class="silver" />
      <path :d="`M${x} 128h14l-4 -7h-10z`" class="silver-shade" />
      <rect :x="x - 2.8" y="92" width="5.6" height="30" class="silver" />
      <rect :x="x" y="92" width="2.8" height="30" class="silver-shade" />
      <ellipse :cx="x" cy="106" rx="6" ry="2.6" class="silver-shade" />
      <path :d="`M${x - 11} 86h22l-3.4 7.5h-15.2z`" class="silver" />
      <path :d="`M${x} 86h11l-3.4 7.5h-7.6z`" class="silver-shade" />
      <ellipse :cx="x" cy="86" rx="11" ry="2.8" class="silver-light" />

      <!-- The candle, its wick, its flame. -->
      <rect :x="x - 6" y="34" width="12" height="52" rx="1.5" class="wax" />
      <rect :x="x + 1.6" y="34" width="4.4" height="52" class="wax-side" />
      <path :d="`M${x} 34v-4.5`" class="wick" />
      <path
        :d="`M${x} 6c6.5 7.5 8.8 12 7.7 16.5s-4.4 6.6-7.7 6.6-6.6-2.2-7.7-6.6 1.2-9 7.7-16.5z`"
        class="flame"
      />
      <path
        :d="`M${x} 12.5c3.8 4.4 5.5 7.7 4.4 10.4s-2.2 3.8-4.4 3.8-3.7-1.1-4.4-3.8 0.6-6 4.4-10.4z`"
        class="flame-in"
      />
      <ellipse :cx="x" cy="23.5" rx="2" ry="2.8" class="flame-core" />
    </g>
  </svg>
</template>

<style scoped>
.silver {
  fill: #cdd0d6;
}
.silver-shade {
  fill: #a8acb4;
}
.silver-light {
  fill: #eceef1;
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
</style>
