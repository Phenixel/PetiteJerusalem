<script setup lang="ts">
// "Bibliothèque" hero illustration: books on a shelf, one leaning. The books
// rise onto the shelf on load; the leaning book slides out when the parent
// .feature-card is hovered, as if being picked.
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
    <!-- shelf -->
    <path class="shelf" d="M8 53h48" />
    <!-- standing books -->
    <g class="tome tome-1">
      <rect x="13" y="22" width="9" height="31" rx="1.5" />
      <path d="M13 28h9" stroke-width="2" />
    </g>
    <g class="tome tome-2">
      <rect x="24" y="16" width="9" height="37" rx="1.5" />
      <path d="M24 22h9" stroke-width="2" />
      <path d="M24 47h9" stroke-width="2" />
    </g>
    <!-- leaning book (accent) -->
    <g class="tome tome-3 accent">
      <rect x="40" y="21" width="9" height="32" rx="1.5" transform="rotate(9 44.5 53)" />
      <path d="M40 27h9" stroke-width="2" transform="rotate(9 44.5 53)" />
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

/* --- entrance: shelf draws, books rise one by one --- */
.shelf {
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: illu-draw 0.6s ease-out forwards;
}

.tome {
  opacity: 0;
  transform: translateY(10px);
  animation: illu-rise 0.5s ease-out forwards;
}
.tome-1 {
  animation-delay: 0.35s;
}
.tome-2 {
  animation-delay: 0.5s;
}
.tome-3 {
  animation-delay: 0.65s;
}

@keyframes illu-draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes illu-rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* --- hover (parent card): the leaning book gets picked --- */
:global(.feature-card:hover) .tome {
  animation: none;
  opacity: 1;
  transform: none;
  transform-box: fill-box;
  transform-origin: bottom center;
  transition: transform 0.3s ease;
}
:global(.feature-card:hover) .tome-3 {
  transform: translateY(-5px) rotate(4deg);
}
:global(.feature-card:hover) .tome-2 {
  transform: translateY(-2px);
}
:global(.feature-card:hover) .tome-1 {
  transform: translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
  .shelf,
  .tome {
    animation: none;
    opacity: 1;
    transform: none;
    stroke-dashoffset: 0;
  }
  :global(.feature-card:hover) .tome {
    transform: none;
  }
}
</style>
