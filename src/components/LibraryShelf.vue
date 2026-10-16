<script setup lang="ts">
// Étagère de la bibliothèque : les grandes sections sont des livres reliés,
// posés côte à côte sur une planche, à la manière d'un rayonnage de sefarim.
// Volontairement hors du thème de couleurs sélectionnable : les livres gardent
// des teintes chaudes et mates (terre cuite, bronze, brun) qui prolongent le
// fond beige du site, comme de vrais objets, identiques en mode sombre.
// Titre horizontal en serif dans un cadre estampé crème, tranche de pages
// ivoire sur la droite. Au survol (ou au toucher), le livre se soulève
// doucement de l'étagère ; à l'arrivée, les livres se posent un à un, mais
// seulement de loin en loin (voir useShelfIntro) : au quotidien, on vient
// ouvrir un livre, pas regarder les livres arriver.

import { reactive, watch } from "vue";
import { shouldPlayShelfIntro } from "../composables/useShelfIntro";
import { prefersLessMotion } from "../composables/useMotion";
import { bindingOf } from "../config/bindings";

export interface ShelfBook {
  /** Identifiant de corpus (tehilim, michna, talmud, tanakh, moussar, sidour…). */
  corpus: string;
  /** Destination du lien. */
  to: string;
  /** Titre écrit sur la couverture. */
  label: string;
  /**
   * App native : la part du livre qui est sur le téléphone (0 à 1), en
   * nombre de livres du corpus. Absent sur le site.
   */
  offline?: number;
  /** Ce que le lien annonce aux lecteurs d'écran, état compris. */
  ariaLabel?: string;
}

const props = withDefaults(
  defineProps<{
    books: ShelfBook[];
    /** Décalage de l'animation d'entrée : la 2e étagère se garnit après la 1re. */
    startIndex?: number;
    /**
     * Les places de la planche, quand elle n'est pas pleine : un volume seul
     * sur la deuxième planche garde la largeur de ceux de la première, au
     * lieu de s'étaler.
     */
    places?: number;
  }>(),
  { startIndex: 0 },
);

// --- La pastille du hors ligne, dans l'angle de la couverture ---
// Une coche quand tout le livre est sur le téléphone (le même signe que sur
// chaque texte de sa liste), un anneau qui se remplit quand il ne l'est qu'en
// partie, rien sinon : l'étagère reste nue tant qu'on n'a rien téléchargé.
const RING = 2 * Math.PI * 5.6;
const isDone = (book: ShelfBook) => (book.offline ?? 0) >= 0.999;
const hasBadge = (book: ShelfBook) => (book.offline ?? 0) > 0.001;
const ringDash = (book: ShelfBook) =>
  `${(RING * Math.min(1, book.offline ?? 0)).toFixed(2)} ${RING.toFixed(2)}`;

// Un livre qui vient d'arriver en entier, pendant qu'on le regardait : la
// coche se trace, la pastille et le livre sautent un peu. Seulement sur ce
// passage, provoqué par un téléchargement : jamais à l'arrivée sur la page.
const landed = reactive(new Set<string>());
watch(
  () => props.books.map((book) => [book.corpus, isDone(book)] as const),
  (now, before) => {
    if (!before || prefersLessMotion()) return;
    const wasDone = new Map(before);
    for (const [corpus, done] of now) {
      if (!done || wasDone.get(corpus) !== false) continue;
      landed.add(corpus);
      setTimeout(() => landed.delete(corpus), 900);
    }
  },
);

/**
 * Un titre en hébreu ne prend pas d'interlettrage. WebKit (Safari, l'app
 * iPhone) pose alors chaque lettre d'un texte SVG l'une après l'autre, de
 * gauche à droite, et l'hébreu se lit à l'envers ; et l'hébreu ne s'espace
 * pas, de toute façon.
 */
const HEBREW = /[\u0590-\u05ff]/;

const emit = defineEmits<{ (e: "open", corpus: string): void }>();

// Tranché une fois pour toute la page.
const playIntro = shouldPlayShelfIntro();
</script>

<template>
  <div class="shelf-wrap" :class="{ 'shelf-intro': playIntro }">
    <div
      class="shelf-books"
      :class="{ 'shelf-places': places }"
      :style="places ? { '--places': places } : undefined"
      role="list"
    >
      <RouterLink
        v-for="(book, index) in books"
        :key="book.corpus"
        :to="book.to"
        class="book"
        :class="{ 'book-landed': landed.has(book.corpus) }"
        :style="{ '--i': startIndex + index, '--binding': bindingOf(book.corpus) }"
        role="listitem"
        :aria-label="book.ariaLabel ?? book.label"
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
                :class="{ 'book-title-spaced': !HEBREW.test(book.label) }"
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
            <!-- dans l'angle de la couverture : le livre est sur le téléphone -->
            <Transition name="book-badge">
              <span
                v-if="hasBadge(book)"
                class="book-badge"
                :class="{ 'book-badge-landed': landed.has(book.corpus) }"
                aria-hidden="true"
              >
                <svg viewBox="0 0 20 20" class="book-badge-svg">
                  <path v-if="isDone(book)" class="book-check" d="M6 10.4l2.7 2.7L14.2 7.6" />
                  <template v-else>
                    <circle class="book-ring-track" cx="10" cy="10" r="5.6" />
                    <circle
                      class="book-ring"
                      cx="10"
                      cy="10"
                      r="5.6"
                      :stroke-dasharray="ringDash(book)"
                      transform="rotate(-90 10 10)"
                    />
                  </template>
                </svg>
              </span>
            </Transition>
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
  --shelf-gap: 0.55rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--shelf-gap);
}

@media (min-width: 640px) {
  .shelf-books {
    --shelf-gap: 1rem;
  }
}

/* Une planche qui n'est pas pleine : chaque volume prend la largeur d'une
   place, comme sur une planche garnie. */
.shelf-places .book {
  flex: 0 0 calc((100% - (var(--places) - 1) * var(--shelf-gap)) / var(--places));
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
}

/* Le mois où les livres se posent un à un : sans cette classe, ils sont
   simplement là, et le premier geste ne se heurte à rien. */
.shelf-intro .book-rise {
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
  position: relative;
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
}

/* L'interlettrage, pour un titre en lettres latines seulement (voir HEBREW). */
.book-title-spaced {
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
   d'emblée, seuls les livres viennent s'y poser. */
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

/* --- La pastille du hors ligne ---
   Posée dans l'angle haut de la couverture, à quelques pixels de ses bords
   (la couverture va de 3 à 87 sur 96 en largeur, de 3 à 137 sur 140 en
   hauteur). Blanche, comme un petit sceau, la couleur secondaire du thème
   pour le signe (un état, pas une action) : elle se lit sur toutes les
   reliures. */
.book-badge {
  position: absolute;
  top: calc(2.1% + 3px);
  right: calc(9.4% + 3px);
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  background: #fff;
  color: var(--color-secondary);
  box-shadow: 0 1px 2px rgb(30 26 18 / 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}
.book-badge-svg {
  width: 18px;
  height: 18px;
  fill: none;
}
.book-check {
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 12;
  stroke-dashoffset: 0;
}
.book-ring-track {
  stroke: #e7dfcf;
  stroke-width: 2.8;
}
/* L'anneau se remplit à mesure que les livres du corpus arrivent. */
.book-ring {
  stroke: currentColor;
  stroke-width: 2.8;
  transition: stroke-dasharray 0.5s ease;
}

/* La pastille paraît au premier livre téléchargé, s'efface quand on
   supprime : un mouvement qui suit le geste, rien à l'arrivée sur la page. */
.book-badge-enter-active,
.book-badge-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.book-badge-enter-from,
.book-badge-leave-to {
  transform: scale(0.4);
  opacity: 0;
}

/* Le livre arrivé en entier : la coche se trace, la pastille saute, le livre
   se soulève un instant et se repose sur la planche. */
.book-badge-landed {
  animation: book-badge-pop 0.5s cubic-bezier(0.3, 1.5, 0.5, 1);
}
.book-badge-landed .book-check {
  animation: book-check-draw 0.4s ease-out 0.1s both;
}
.book-landed .book-lift {
  animation: book-landed 0.6s ease-out;
}
@keyframes book-badge-pop {
  0% {
    transform: scale(0.6);
  }
  60% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes book-check-draw {
  from {
    stroke-dashoffset: 12;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes book-landed {
  0%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-7px);
  }
}
:root.perf-lite .book-badge-landed,
:root.perf-lite .book-badge-landed .book-check,
:root.perf-lite .book-landed .book-lift {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .book-badge-landed,
  .book-badge-landed .book-check,
  .book-landed .book-lift {
    animation: none;
  }
  .book-badge-enter-active,
  .book-badge-leave-active,
  .book-ring {
    transition: none;
  }
  .shelf-intro .book-rise {
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
