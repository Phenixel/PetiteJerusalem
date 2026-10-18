<script setup lang="ts">
import MockScreen from "./MockScreen.vue";

/**
 * The Talmud in its page: the Gemara column is laid down, Rashi and Tosafot
 * come and frame it as in the printed book, then the French translation of
 * the passage rises under it. Shown by the "what's new" tour
 * (WhatsNewTour.vue).
 *
 * The translation is in French in every language: that is the news.
 */
</script>

<template>
  <MockScreen height="10rem">
    <div class="page">
      <!-- First in the markup, first on the right. -->
      <div class="column side side-rashi">
        <span class="label">רש״י</span>
        <span v-for="n in 7" :key="n" class="line line-thin"></span>
      </div>
      <div class="column gemara">
        <span class="opening">מאימתי</span>
        <span v-for="n in 5" :key="n" class="line" :style="{ '--i': n }"></span>
      </div>
      <div class="column side side-tosafot">
        <span class="label">תוספות</span>
        <span v-for="n in 7" :key="n" class="line line-thin"></span>
      </div>
    </div>

    <div class="translation">
      <p class="he">מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִין</p>
      <p class="fr">À partir de quand lit-on le Chema le soir&#8239;?</p>
    </div>
  </MockScreen>
</template>

<style scoped>
/* The page: its columns side by side, always from right to left. */
.page {
  position: absolute;
  inset: 0.8rem 1rem 3.2rem;
  display: flex;
  flex-direction: row-reverse;
  gap: 0.4rem;
  direction: ltr;
}

.column {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  padding: 0.35rem 0.4rem;
  border-radius: 0.3rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.gemara {
  flex: 1.3;
}

.side {
  flex: 1;
}

.label,
.opening {
  font-family: var(--font-hebrew);
  direction: rtl;
  color: var(--color-text-primary);
  line-height: 1;
}

.label {
  font-size: 0.45rem;
  color: var(--color-text-secondary);
}

.opening {
  font-size: 0.75rem;
  font-weight: 700;
}

.line {
  height: 0.22rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}

.line-thin {
  height: 0.16rem;
  background-color: color-mix(in srgb, var(--color-text-primary) 16%, transparent);
}

/* The Gemara first, line after line. */
.gemara .line {
  transform-origin: right;
  animation: line-in 7s ease-out infinite;
  animation-delay: calc(var(--i) * 0.12s);
}

@keyframes line-in {
  0% {
    transform: scaleX(0);
  }
  10%,
  92% {
    transform: scaleX(1);
  }
  100% {
    transform: scaleX(0);
  }
}

/* Then the commentaries, each from its own side. */
.side-rashi {
  animation: rashi-in 7s cubic-bezier(0.3, 1.3, 0.55, 1) infinite;
}

.side-tosafot {
  animation: tosafot-in 7s cubic-bezier(0.3, 1.3, 0.55, 1) infinite;
}

@keyframes rashi-in {
  0%,
  14% {
    opacity: 0;
    transform: translateX(1.5rem);
  }
  24%,
  92% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
    transform: translateX(1.5rem);
  }
}

@keyframes tosafot-in {
  0%,
  20% {
    opacity: 0;
    transform: translateX(-1.5rem);
  }
  30%,
  92% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
    transform: translateX(-1.5rem);
  }
}

/* The translation, last, under the page. */
.translation {
  position: absolute;
  inset: auto 1rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.35rem 0.6rem;
  border-radius: 0.45rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: 0.55rem;
  line-height: 1.35;
  text-align: center;
  animation: translation-in 7s ease-out infinite;
}

.he {
  font-family: var(--font-hebrew);
  direction: rtl;
  color: var(--color-text-primary);
}

.fr {
  color: var(--color-text-secondary);
}

@keyframes translation-in {
  0%,
  40% {
    opacity: 0;
    transform: translateY(0.8rem);
  }
  48%,
  92% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
    transform: translateY(0.8rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gemara .line,
  .side,
  .translation {
    animation: none;
  }
}
</style>
