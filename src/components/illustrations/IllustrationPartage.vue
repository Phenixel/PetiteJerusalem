<script setup lang="ts">
// "Partage de lecture" hero illustration: an open book shared between three
// readers. Draws itself in on load; the link lines flow and the readers lean
// in when the parent .feature-card is hovered.
</script>

<template>
  <svg
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="illu"
  >
    <!-- open book -->
    <g class="book">
      <path class="draw draw-1" d="M6 42q13-6 26 0v13q-13-6-26 0z" />
      <path class="draw draw-1" d="M58 42q-13-6-26 0v13q13-6 26 0z" />
      <path class="draw draw-2 accent" d="M12 46.5q8-3 16 0" stroke-width="2" />
      <path class="draw draw-2 accent" d="M36 46.5q8-3 16 0" stroke-width="2" />
    </g>

    <!-- link lines from each reader to the book -->
    <g class="links accent" stroke-width="2" stroke-dasharray="3 5">
      <path class="link" d="M14 27v6" />
      <path class="link" d="M32 21v10" />
      <path class="link" d="M50 27v6" />
    </g>

    <!-- three readers -->
    <g class="reader reader-1">
      <circle cx="14" cy="14" r="4.5" />
      <path d="M7.5 23.5q6.5-5 13 0" />
    </g>
    <g class="reader reader-2">
      <circle cx="32" cy="9" r="4.5" />
      <path d="M25.5 18.5q6.5-5 13 0" />
    </g>
    <g class="reader reader-3">
      <circle cx="50" cy="14" r="4.5" />
      <path d="M43.5 23.5q6.5-5 13 0" />
    </g>
  </svg>
</template>

<style scoped>
.illu {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.accent {
  stroke: var(--color-secondary);
}

/* --- entrance: the book draws itself, readers pop in --- */
.draw {
  stroke-dasharray: 120;
  stroke-dashoffset: 120;
  animation: illu-draw 0.9s ease-out forwards;
}
.draw-2 {
  animation-delay: 0.35s;
}

.reader {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  transform: translateY(6px) scale(0.6);
  animation: illu-pop 0.5s ease-out forwards;
}
.reader-1 {
  animation-delay: 0.5s;
}
.reader-2 {
  animation-delay: 0.65s;
}
.reader-3 {
  animation-delay: 0.8s;
}

.link {
  opacity: 0;
  animation: illu-fade 0.4s ease-out 1s forwards;
}

@keyframes illu-draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes illu-pop {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes illu-fade {
  to {
    opacity: 1;
  }
}

/* --- hover (parent card): links flow toward the book, readers lean in --- */
:global(.feature-card:hover) .link {
  animation: illu-flow 0.8s linear infinite;
  opacity: 1;
}
:global(.feature-card:hover) .reader {
  animation: none;
  opacity: 1;
  transform: none;
  transition: transform 0.3s ease;
}
:global(.feature-card:hover) .reader-1 {
  transform: translate(2px, 2px);
}
:global(.feature-card:hover) .reader-2 {
  transform: translateY(2.5px);
}
:global(.feature-card:hover) .reader-3 {
  transform: translate(-2px, 2px);
}
:global(.feature-card:hover) .book {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 0.3s ease;
  transform: scale(1.06);
}

@keyframes illu-flow {
  to {
    stroke-dashoffset: -8;
  }
}

@media (prefers-reduced-motion: reduce) {
  .draw,
  .reader,
  .link {
    animation: none;
    opacity: 1;
    transform: none;
    stroke-dashoffset: 0;
  }
  :global(.feature-card:hover) .link,
  :global(.feature-card:hover) .book,
  :global(.feature-card:hover) .reader {
    animation: none;
    transform: none;
  }
}
</style>
