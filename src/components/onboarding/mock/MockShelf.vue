<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * La bibliothèque : la barre de recherche, et les corpus posés en volumes sur
 * une planche, comme un rayonnage de sefarim (voir LibraryShelf, dont ce
 * dessin reprend les teintes). Un doigt vient ouvrir l'un d'eux.
 */

const { t } = useI18n();

const books = [
  { key: "tehilim", binding: "#96604a", labelKey: "study.types.tehilim" },
  { key: "michna", binding: "#7d6a4c", labelKey: "study.types.mishna" },
  { key: "talmud", binding: "#6d5743", labelKey: "study.types.talmud" },
  { key: "tanakh", binding: "#84483f", labelKey: "study.types.tanakh" },
] as const;
</script>

<template>
  <MockScreen height="11rem">
    <div class="search">
      <AppIcon name="search" :size="10" />
      <span class="search-bar"></span>
    </div>

    <div class="shelf">
      <span
        v-for="(book, index) in books"
        :key="book.key"
        class="book"
        :style="{ '--i': index, '--binding': book.binding }"
      >
        <span class="book-title">{{ t(book.labelKey) }}</span>
      </span>
      <MockTouch class="tap" duration="5s" delay="1.2s" :taps="1" />
    </div>
    <span class="board"></span>
  </MockScreen>
</template>

<style scoped>
.search {
  position: absolute;
  inset: 0.75rem 1rem auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.5rem;
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
  box-shadow: inset 0 0 0 1px var(--color-line);
}

.search-bar {
  display: block;
  width: 45%;
  height: 0.28rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
}

.shelf {
  position: absolute;
  inset: auto 1rem 1.35rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.45rem;
}

/* Un volume : reliure chaude, filet crème estampé, tranche de pages ivoire. */
.book {
  position: relative;
  display: flex;
  height: 4.4rem;
  flex: 1 1 0;
  max-width: 3.2rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.2rem 0.28rem 0.28rem 0.2rem;
  background-color: var(--binding);
  box-shadow:
    inset 0.14rem 0 0 rgb(0 0 0 / 0.18),
    inset -0.22rem 0 0 #efe5d0,
    0 0.15rem 0.3rem rgb(0 0 0 / 0.18);
  opacity: 0;
  animation: rise 0.5s ease-out forwards;
  animation-delay: calc(var(--i) * 0.12s);
}

.book::after {
  content: "";
  position: absolute;
  inset: 0.35rem 0.45rem 0.35rem 0.35rem;
  border: 0.5px solid #ecdfc4;
  border-radius: 0.1rem;
  opacity: 0.5;
}

.book-title {
  position: relative;
  z-index: 1;
  padding-right: 0.2rem;
  font-family: var(--font-serif);
  font-size: 0.42rem;
  font-weight: 600;
  color: #f3ead6;
  text-align: center;
  line-height: 1.1;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Le troisième volume se soulève, comme au toucher. */
.book:nth-child(3) {
  animation:
    rise 0.5s ease-out 0.24s forwards,
    lift 5s ease-in-out 1.2s infinite;
}

@keyframes lift {
  0%,
  30% {
    transform: translateY(0);
  }
  45%,
  70% {
    transform: translateY(-0.45rem);
  }
  85%,
  100% {
    transform: translateY(0);
  }
}

/* Le doigt qui ouvre un volume : le centre du troisième sur quatre, celui
   qui se soulève. */
.touch.tap {
  top: auto;
  /* Le centre du troisième volume sur quatre, celui qui se soulève. */
  left: 62.5%;
  bottom: 0.55rem;
  margin: 0 0 -0.65rem -0.65rem;
  animation: tap-fade 5s ease-out 1.2s infinite;
}

@keyframes tap-fade {
  0%,
  22% {
    opacity: 1;
  }
  34%,
  92% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* La planche de l'étagère, en bois clair. */
.board {
  position: absolute;
  inset: auto 0.6rem 0.9rem;
  height: 0.35rem;
  border-radius: 0.1rem;
  background: linear-gradient(180deg, #c9ab7d, #a8885c);
  box-shadow: 0 0.15rem 0.35rem rgb(0 0 0 / 0.15);
}

@media (prefers-reduced-motion: reduce) {
  .book,
  .book:nth-child(3),
  .touch.tap {
    animation: none;
    opacity: 1;
  }
  .touch.tap {
    opacity: 0;
  }
}
</style>
