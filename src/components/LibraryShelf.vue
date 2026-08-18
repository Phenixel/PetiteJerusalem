<script setup lang="ts">
// Étagère de la bibliothèque : les grandes sections sont des livres reliés,
// posés côte à côte sur une planche, à la manière d'un rayonnage de sefarim.
// Volontairement hors du thème de couleurs sélectionnable : les livres gardent
// des teintes chaudes et mates (terre cuite, bronze, brun) qui prolongent le
// fond beige du site — comme de vrais objets, identiques en mode sombre.
// Titre horizontal en serif dans un cadre estampé crème, tranche de pages
// ivoire sur la droite. Au survol (ou au toucher), le livre se soulève
// doucement de l'étagère ; à l'arrivée, les livres se posent un à un.

export interface ShelfBook {
  /** Identifiant de corpus (tehilim, michna, talmud, tanakh). */
  corpus: string;
  /** Destination du lien. */
  to: string;
  /** Titre écrit sur la couverture. */
  label: string;
}

withDefaults(
  defineProps<{
    books: ShelfBook[];
    /** Décalage de l'animation d'entrée : la 2e étagère se garnit après la 1re. */
    startIndex?: number;
  }>(),
  { startIndex: 0 },
);

const emit = defineEmits<{ (e: "open", corpus: string): void }>();

// Reliures : une teinte chaude par volume, toutes de la même famille pour
// rester sobres (un vrai jeu de volumes, pas un arc-en-ciel).
const BINDINGS: Record<string, string> = {
  tehilim: "#96604a",
  michna: "#7d6a4c",
  talmud: "#6d5743",
  tanakh: "#84483f",
  slihot: "#7a5c36",
  brahot: "#5f6249",
};

function bindingOf(corpus: string): string {
  return BINDINGS[corpus] ?? "#7d6a4c";
}
</script>

<template>
  <div class="shelf-wrap">
    <div class="shelf-books" role="list">
      <RouterLink
        v-for="(book, index) in books"
        :key="book.corpus"
        :to="book.to"
        class="book"
        :style="{ '--i': startIndex + index, '--binding': bindingOf(book.corpus) }"
        role="listitem"
        :aria-label="book.label"
        @click="emit('open', book.corpus)"
      >
        <span class="book-rise">
          <span class="book-lift">
            <svg viewBox="0 0 96 140" fill="none" aria-hidden="true" class="book-svg">
              <defs>
                <linearGradient :id="`book-shine-${book.corpus}`" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#fff" stop-opacity="0.09" />
                  <stop offset="0.45" stop-color="#fff" stop-opacity="0.02" />
                  <stop offset="1" stop-color="#000" stop-opacity="0.06" />
                </linearGradient>
              </defs>
              <!-- tranche des pages, ivoire, qui dépasse à droite -->
              <rect x="84" y="6" width="9" height="128" rx="2" fill="#efe5d0" />
              <path d="M87 10v120M90 10v120" stroke="#d6c8ab" stroke-width="0.8" />
              <!-- couverture -->
              <rect x="3" y="3" width="84" height="134" rx="4" fill="var(--binding)" />
              <!-- pli de la reliure, côté dos -->
              <rect x="3" y="3" width="7" height="134" rx="3.5" fill="#000" opacity="0.16" />
              <path d="M12 5v130" stroke="#fff" opacity="0.1" stroke-width="1" />
              <!-- lumière douce sur la couverture -->
              <rect
                x="3"
                y="3"
                width="84"
                height="134"
                rx="4"
                :fill="`url(#book-shine-${book.corpus})`"
              />
              <!-- cadre estampé, double filet crème -->
              <rect
                class="frame"
                x="18"
                y="14"
                width="62"
                height="112"
                rx="1.5"
                stroke="#ecdfc4"
                stroke-width="1.4"
                opacity="0.55"
              />
              <rect
                class="frame frame-inner"
                x="22.5"
                y="18.5"
                width="53"
                height="103"
                rx="1"
                stroke="#ecdfc4"
                stroke-width="0.7"
                opacity="0.3"
              />
              <!-- titre horizontal, en serif, comme doré à chaud -->
              <text
                class="book-title"
                x="49"
                y="62"
                text-anchor="middle"
                dominant-baseline="central"
              >
                {{ book.label }}
              </text>
              <!-- fine ornementation sous le titre -->
              <g class="ornament" stroke="#ecdfc4" opacity="0.5">
                <path d="M35 80h11M52 80h11" stroke-width="1" />
                <path d="M49 77.2 51.6 80 49 82.8 46.4 80Z" fill="#ecdfc4" stroke="none" />
              </g>
            </svg>
            <!-- ombre portée sur la planche -->
            <span class="book-shadow" aria-hidden="true"></span>
          </span>
        </span>
      </RouterLink>
    </div>
    <!-- la planche de l'étagère, en bois clair -->
    <div class="shelf-board" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.shelf-wrap {
  max-width: 38rem;
  margin-inline: auto;
}

.shelf-books {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.55rem;
}

@media (min-width: 640px) {
  .shelf-books {
    gap: 1rem;
  }
}

.book {
  flex: 1 1 0;
  max-width: 8rem;
  min-width: 0;
  display: block;
  -webkit-tap-highlight-color: transparent;
}

/* L'entrée (posé sur l'étagère) et le survol (soulevé) vivent sur deux
   éléments séparés pour que leurs transforms ne s'écrasent pas. */
.book-rise {
  display: block;
  width: 100%;
  opacity: 0;
  transform: translateY(12px);
  animation: book-rise 0.55s ease-out forwards;
  animation-delay: calc(0.25s + var(--i) * 0.11s);
}

@keyframes book-rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.book-lift {
  display: block;
  transform-origin: bottom center;
  transition: transform 0.4s ease-out;
}

.book-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.book-title {
  font-family: var(--font-serif);
  font-size: 13.5px;
  font-weight: 600;
  fill: #f3ead6;
  letter-spacing: 0.04em;
}

.frame,
.ornament {
  transition: opacity 0.35s ease;
}

/* Ombre portée du livre sur la planche. */
.book-shadow {
  display: block;
  height: 6px;
  margin: -2px auto 0;
  width: 78%;
  border-radius: 9999px;
  background: rgb(58 46 30 / 0.35);
  filter: blur(3px);
  transition:
    transform 0.4s ease-out,
    opacity 0.4s ease-out;
}

:root.dark .book-shadow {
  background: rgb(0 0 0 / 0.55);
}

/* --- Survol : le livre se soulève doucement de l'étagère --- */
@media (hover: hover) {
  .book:hover .book-lift {
    transform: translateY(-9px) rotate(-1.5deg);
  }
  .book:hover .book-shadow {
    transform: scaleX(1.12);
    opacity: 0.55;
  }
  .book:hover .frame,
  .book:hover .ornament {
    opacity: 0.85;
  }
}

/* Sur téléphone (pas de survol) : le même mouvement au toucher. */
.book:active .book-lift {
  transform: translateY(-6px) rotate(-1deg);
}

.book:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
  border-radius: 8px;
}

/* La planche : un bois clair et chaud, hors thème elle aussi. Présente
   d'emblée — seuls les livres viennent s'y poser. */
.shelf-board {
  height: 9px;
  border-radius: 3px;
  background: linear-gradient(#c3a87f, #a98c62);
  box-shadow: 0 3px 6px rgb(58 46 30 / 0.18);
}

:root.dark .shelf-board {
  background: linear-gradient(#8a7354, #6e5a40);
  box-shadow: 0 3px 8px rgb(0 0 0 / 0.5);
}

@media (prefers-reduced-motion: reduce) {
  .book-rise {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .book:hover .book-lift,
  .book:active .book-lift,
  .book:hover .book-shadow {
    transform: none;
    transition: none;
  }
}
</style>
