<script setup lang="ts">
// Étagère de la bibliothèque : les grandes sections sont des livres posés les
// uns à côté des autres, dans le même langage visuel que les illustrations de
// l'accueil (dessin au trait, currentColor, accents en --color-secondary).
// Au survol (ou au toucher), le livre se soulève et s'incline comme si on le
// tirait de l'étagère, sa couverture s'entrouvre (les pages se décalent).
// À l'arrivée sur la page, l'étagère se dessine puis les livres se posent
// un à un — même chorégraphie que l'illustration « Bibliothèque » de l'accueil.

export interface ShelfBook {
  /** Identifiant de corpus (tehilim, michna, talmud, tanakh). */
  corpus: string;
  /** Destination du lien. */
  to: string;
  /** Titre écrit sur le dos du livre. */
  label: string;
  /** Sous-texte affiché sous le livre (« 150 psaumes »…). */
  count: string;
}

defineProps<{ books: ShelfBook[] }>();

const emit = defineEmits<{ (e: "open", corpus: string): void }>();
</script>

<template>
  <div class="shelf-wrap">
    <div class="shelf-books" role="list">
      <RouterLink
        v-for="(book, index) in books"
        :key="book.corpus"
        :to="book.to"
        class="book"
        :style="{ '--i': index }"
        role="listitem"
        :aria-label="`${book.label} — ${book.count}`"
        @click="emit('open', book.corpus)"
      >
        <span class="book-rise">
          <svg
            viewBox="0 0 92 148"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="book-svg text-primary"
          >
            <!-- pages : dépassent de la couverture, s'écartent au survol -->
            <g class="book-pages">
              <path d="M14 12h66a4 4 0 0 1 4 4v112a4 4 0 0 1-4 4H14" stroke-width="2" />
            </g>
            <!-- couverture -->
            <g class="book-cover">
              <rect x="8" y="8" width="72" height="128" rx="5" />
              <!-- bandeaux du dos, accent secondaire -->
              <path class="accent" d="M8 24h72" stroke-width="2" />
              <path class="accent" d="M8 120h72" stroke-width="2" />
              <!-- titre sur le dos, à la verticale comme sur une tranche -->
              <text
                class="book-title"
                x="44"
                y="72"
                transform="rotate(-90 44 72)"
                text-anchor="middle"
                dominant-baseline="central"
              >
                {{ book.label }}
              </text>
              <!-- signet, glisse au survol -->
              <path class="ribbon" d="M62 8v14l5-5 5 5V8" stroke-width="2" />
            </g>
          </svg>
        </span>
      </RouterLink>
    </div>
    <!-- la planche de l'étagère, juste sous les livres -->
    <div class="shelf-board" aria-hidden="true"></div>
    <!-- les compteurs, alignés sous chaque livre (même grille que les livres) -->
    <div class="shelf-counts" aria-hidden="true">
      <span v-for="book in books" :key="book.corpus" class="book-count">
        {{ book.count }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.shelf-wrap {
  max-width: 40rem;
  margin-inline: auto;
}

.shelf-books,
.shelf-counts {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.4rem;
}

@media (min-width: 640px) {
  .shelf-books,
  .shelf-counts {
    gap: 0.9rem;
  }
}

.book,
.book-count {
  flex: 1 1 0;
  max-width: 8.5rem;
  min-width: 0;
}

.book {
  display: block;
  -webkit-tap-highlight-color: transparent;
}

/* L'entrée (posé sur l'étagère) et le survol (soulevé) vivent sur deux
   éléments séparés pour que leurs transforms ne s'écrasent pas. */
.book-rise {
  display: block;
  width: 100%;
  opacity: 0;
  transform: translateY(14px);
  animation: book-rise 0.5s ease-out forwards;
  animation-delay: calc(0.3s + var(--i) * 0.12s);
}

@keyframes book-rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.book-svg {
  width: 100%;
  height: auto;
  overflow: visible;
  transform-origin: bottom center;
  transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.accent {
  stroke: var(--color-secondary);
}

.ribbon {
  stroke: var(--color-secondary);
  transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Les pages, dessinées derrière la couverture : au repos presque confondues. */
.book-pages {
  opacity: 0.55;
  transition:
    transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
}

.book-title {
  font-family: var(--font-sans);
  font-size: 17px;
  font-weight: 700;
  fill: var(--color-text-primary);
  stroke: none;
  letter-spacing: 0.02em;
}

.shelf-counts {
  margin-top: 0.6rem;
}

.book-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-align: center;
  opacity: 0;
  animation: count-appear 0.5s ease-out forwards;
  animation-delay: 0.9s;
}

@keyframes count-appear {
  to {
    opacity: 1;
  }
}

/* --- Survol / toucher : on tire le livre de l'étagère --- */
@media (hover: hover) {
  .book:hover .book-svg {
    transform: translateY(-12px) rotate(-4deg);
  }
  .book:hover .book-pages {
    opacity: 1;
    transform: translate(3px, 2px) rotate(1.5deg);
    transform-origin: bottom left;
    transform-box: fill-box;
  }
  .book:hover .ribbon {
    transform: translateY(5px);
  }
}

/* Sur téléphone (pas de survol) : le même mouvement au toucher. */
.book:active .book-svg {
  transform: translateY(-8px) rotate(-3deg);
}
.book:active .book-pages {
  opacity: 1;
  transform: translate(3px, 2px) rotate(1.5deg);
  transform-origin: bottom left;
  transform-box: fill-box;
}

.book:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
  border-radius: 8px;
}

/* La planche : un trait plein, comme le trait d'étagère de l'accueil,
   qui se dessine à l'arrivée. Les livres sont posés dessus. */
.shelf-board {
  height: 4px;
  margin-top: -2px;
  border-radius: 9999px;
  background: var(--color-primary);
  transform: scaleX(0);
  transform-origin: center;
  animation: shelf-draw 0.55s ease-out forwards;
}

@keyframes shelf-draw {
  to {
    transform: scaleX(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-rise,
  .shelf-board,
  .book-count {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .book:hover .book-svg,
  .book:active .book-svg,
  .book:hover .book-pages,
  .book:active .book-pages,
  .book:hover .ribbon {
    transform: none;
    transition: none;
  }
}
</style>
