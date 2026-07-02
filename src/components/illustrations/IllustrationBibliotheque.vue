<script setup lang="ts">
// "Bibliothèque" hero illustration: books on a shelf, one leaning. The books
// rise onto the shelf on load. On hover of the parent .feature-card, the
// books tidy themselves up: each one hops in turn and the leaning book
// springs upright.
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
  transform-box: fill-box;
  transform-origin: bottom center;
  animation:
    illu-rise 0.5s ease-out 0.65s forwards,
    tome-sway 5s ease-in-out 2s infinite;
}

/* idle: the leaning book rocks gently while nothing happens */
@keyframes tome-sway {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(2.5deg);
  }
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

/* --- hover (parent card): the books tidy themselves up --- */
:global(.feature-card:hover) .tome {
  opacity: 1;
  transform-box: fill-box;
  transform-origin: bottom center;
}
:global(.feature-card:hover) .tome-1 {
  animation: tome-hop 0.5s ease 0s 1 both;
}
:global(.feature-card:hover) .tome-2 {
  animation: tome-hop 0.5s ease 0.12s 1 both;
}
/* the leaning book springs upright (cancels its baked-in 9° tilt),
   with a small overshoot, and stays straight while hovered */
:global(.feature-card:hover) .tome-3 {
  animation: tome-straighten 0.7s ease-out 0.2s both;
}

@keyframes tome-hop {
  0%,
  100% {
    transform: translateY(0);
  }
  45% {
    transform: translateY(-4px);
  }
}

@keyframes tome-straighten {
  0% {
    transform: rotate(0deg);
  }
  55% {
    transform: translateY(-3px) rotate(-11.5deg);
  }
  100% {
    transform: rotate(-9deg);
  }
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
    animation: none;
    transform: none;
  }
}
</style>
