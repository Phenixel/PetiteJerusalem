<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Where things went in 4.0: the bottom bar's four tabs and its clock, then
 * Étude touched, and at the top of its page the three tabs it brings
 * together (Bibliothèque, Chiourim, Partage), the pill sliding from one to
 * the next as each is touched (PageTabs.vue).
 *
 * Three fingers, each visible for its own touch: one loop, three taps. In
 * Hebrew the bar and the tabs run from the right, as in the app (`--way`).
 */

const { t, locale } = useI18n();
/** 1 from the left, -1 from the right (Hebrew). */
const way = computed(() => (locale.value === "he" ? -1 : 1));
</script>

<template>
  <MockScreen height="11.5rem" :style="{ '--way': way }">
    <!-- The page above the bar: the home page first, then Étude. -->
    <div class="page page-home">
      <span v-for="line in 4" :key="line" class="line" :style="{ '--i': line }"></span>
    </div>

    <div class="page page-study">
      <div class="tabs">
        <span class="pill" aria-hidden="true"></span>
        <span class="seg">{{ t("study.tabs.reading") }}</span>
        <span class="seg">{{ t("study.tabs.chiourim") }}</span>
        <span class="seg">{{ t("study.tabs.sharing") }}</span>
      </div>
      <div class="views">
        <div class="view view-books">
          <span class="spine" style="--c: #7a3b2e"></span>
          <span class="spine" style="--c: #6b5a2b"></span>
          <span class="spine" style="--c: #2f4a3a"></span>
          <span class="spine" style="--c: #5a2f3f"></span>
        </div>
        <div class="view view-classes">
          <span class="avatar"></span>
          <span class="avatar"></span>
          <span class="avatar"></span>
        </div>
        <div class="view view-chains">
          <span class="chain"><span class="chain-fill" style="--p: 62%"></span></span>
          <span class="chain"><span class="chain-fill" style="--p: 28%"></span></span>
        </div>
      </div>
    </div>

    <!-- The bottom bar: four tabs and the times circle in the middle. -->
    <nav class="bar">
      <span class="tab tab-home"> <AppIcon name="home" :size="11" />{{ t("common.home") }} </span>
      <span class="tab"> <AppIcon name="book-open" :size="11" />{{ t("common.sidour") }} </span>
      <span class="clock"><AppIcon name="clock" :size="12" /></span>
      <span class="tab tab-study">
        <AppIcon name="book-reader" :size="11" />{{ t("common.study") }}
      </span>
      <span class="tab"> <AppIcon name="user" :size="11" />{{ t("common.profile") }} </span>
    </nav>

    <MockTouch class="finger finger-study" duration="8s" delay="1.1s" />
    <MockTouch class="finger finger-classes" duration="8s" delay="3.4s" />
    <MockTouch class="finger finger-chains" duration="8s" delay="5.4s" />
  </MockScreen>
</template>

<style scoped>
.page {
  position: absolute;
  inset: 0.8rem 0.9rem 3rem;
}

.page-home {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.45rem;
  animation: home 8s ease-in-out infinite;
}

.line {
  display: block;
  height: 0.3rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  width: calc(100% - var(--i) * 12%);
}

.page-study {
  opacity: 0;
  animation: study 8s ease-in-out infinite;
}

/* The tabs at the top of Étude, with the pill that slides under them. */
.tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 0.15rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  font-size: 0.5rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.seg {
  position: relative;
  z-index: 1;
  padding: 0.25rem 0;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill {
  position: absolute;
  top: 0.15rem;
  bottom: 0.15rem;
  inset-inline-start: 0.15rem;
  width: calc((100% - 0.3rem) / 3);
  border-radius: 999px;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  animation: pill 8s ease-in-out infinite;
}

.views {
  position: relative;
  height: 4.6rem;
  margin-top: 0.6rem;
}

.view {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  opacity: 0;
}

.view-books {
  align-items: flex-end;
  padding-bottom: 0.6rem;
  border-bottom: 0.2rem solid color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  animation: books 8s ease-in-out infinite;
}

.spine {
  display: block;
  width: 1.5rem;
  height: 3.2rem;
  border-radius: 0.12rem 0.25rem 0.25rem 0.12rem;
  background-color: var(--c);
  box-shadow: inset 0.15rem 0 0 rgb(0 0 0 / 0.22);
}

.view-classes {
  animation: classes 8s ease-in-out infinite;
}

.avatar {
  display: block;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-surface));
}

.view-chains {
  flex-direction: column;
  gap: 0.4rem;
  animation: chains 8s ease-in-out infinite;
}

.chain {
  display: block;
  width: 100%;
  height: 1.5rem;
  padding: 0.6rem 0.6rem 0;
  border-radius: 0.5rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.chain-fill {
  display: block;
  height: 0.25rem;
  overflow: hidden;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
}

.chain-fill::before {
  content: "";
  display: block;
  width: var(--p);
  height: 100%;
  background-color: var(--color-brand);
}

.bar {
  position: absolute;
  inset: auto 0 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  height: 2.5rem;
  padding: 0 0.3rem;
  background-color: var(--color-surface);
  box-shadow: 0 -0.05rem 0 var(--color-line);
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  font-size: 0.42rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.tab-home {
  animation: tab-home 8s ease-in-out infinite;
}

.tab-study {
  animation: tab-study 8s ease-in-out infinite;
}

.clock {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  margin: -0.9rem auto 0;
  place-items: center;
  border-radius: 999px;
  background-color: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: var(--shadow-pop);
}

/* Each finger shows for its own touch. */
.finger {
  opacity: 0;
}

/* Placed from the middle, so that they follow the bar in Hebrew. */
.finger-study {
  left: calc(50% + var(--way) * 20%);
  top: calc(100% - 1.3rem);
  animation: finger-study 8s ease-in-out infinite;
}

.finger-classes {
  left: 50%;
  top: 1.3rem;
  animation: finger-classes 8s ease-in-out infinite;
}

.finger-chains {
  left: calc(50% + var(--way) * 32%);
  top: 1.3rem;
  animation: finger-chains 8s ease-in-out infinite;
}

@keyframes finger-study {
  0%,
  6% {
    opacity: 0;
  }
  10%,
  18% {
    opacity: 1;
  }
  23%,
  100% {
    opacity: 0;
  }
}

@keyframes finger-classes {
  0%,
  35% {
    opacity: 0;
  }
  39%,
  47% {
    opacity: 1;
  }
  52%,
  100% {
    opacity: 0;
  }
}

@keyframes finger-chains {
  0%,
  60% {
    opacity: 0;
  }
  64%,
  72% {
    opacity: 1;
  }
  77%,
  100% {
    opacity: 0;
  }
}

/* Home until Étude is touched, and again at the end of the loop. */
@keyframes home {
  0%,
  14% {
    opacity: 1;
  }
  19%,
  92% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes study {
  0%,
  14% {
    opacity: 0;
  }
  19%,
  90% {
    opacity: 1;
  }
  96%,
  100% {
    opacity: 0;
  }
}

@keyframes tab-home {
  0%,
  14% {
    color: var(--color-primary);
  }
  16%,
  92% {
    color: var(--color-text-secondary);
  }
  100% {
    color: var(--color-primary);
  }
}

@keyframes tab-study {
  0%,
  14% {
    color: var(--color-text-secondary);
  }
  16%,
  92% {
    color: var(--color-primary);
  }
  100% {
    color: var(--color-text-secondary);
  }
}

@keyframes pill {
  0%,
  43% {
    transform: none;
  }
  48%,
  68% {
    transform: translateX(calc(var(--way) * 100%));
  }
  73%,
  92% {
    transform: translateX(calc(var(--way) * 200%));
  }
  100% {
    transform: none;
  }
}

@keyframes books {
  0%,
  15% {
    opacity: 0;
  }
  19%,
  43% {
    opacity: 1;
  }
  47%,
  100% {
    opacity: 0;
  }
}

@keyframes classes {
  0%,
  43% {
    opacity: 0;
  }
  47%,
  68% {
    opacity: 1;
  }
  72%,
  100% {
    opacity: 0;
  }
}

@keyframes chains {
  0%,
  68% {
    opacity: 0;
  }
  72%,
  90% {
    opacity: 1;
  }
  96%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page,
  .view,
  .pill,
  .tab-home,
  .tab-study,
  .finger {
    animation: none;
  }
  /* Étude, open on its library, the finger on its tab. */
  .page-home {
    opacity: 0;
  }
  .page-study,
  .view-books,
  .finger-study {
    opacity: 1;
  }
  .tab-study {
    color: var(--color-primary);
  }
}
</style>
