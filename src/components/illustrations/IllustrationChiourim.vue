<script setup lang="ts">
// "Chiourim" hero illustration: headphones with an equalizer. Draws itself in
// on load; the equalizer starts playing when the parent .feature-card is
// hovered.
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
    <!-- headband -->
    <path class="draw" d="M10 40v-6a22 22 0 0 1 44 0v6" />
    <!-- ear cups -->
    <g class="cup cup-l">
      <path d="M10 36h2a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-2a2 2 0 0 1-2-2V38a2 2 0 0 1 2-2z" />
    </g>
    <g class="cup cup-r">
      <path d="M54 36h-2a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h2a2 2 0 0 0 2-2V38a2 2 0 0 0-2-2z" />
    </g>
    <!-- equalizer -->
    <g class="accent" stroke-width="3">
      <path class="bar bar-1" d="M25 46v-6" />
      <path class="bar bar-2" d="M32 48v-12" />
      <path class="bar bar-3" d="M39 46v-7" />
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

/* --- entrance --- */
.draw {
  stroke-dasharray: 90;
  stroke-dashoffset: 90;
  animation: illu-draw 0.9s ease-out forwards;
}

.cup {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0.5);
  animation: illu-pop 0.45s ease-out forwards;
}
.cup-l {
  animation-delay: 0.55s;
}
.cup-r {
  animation-delay: 0.7s;
}

.bar {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: bottom center;
  transform: scaleY(0.2);
}
.bar-1 {
  animation:
    illu-rise 0.45s ease-out 0.85s forwards,
    illu-breathe 3.2s ease-in-out 1.5s infinite;
}
.bar-2 {
  animation:
    illu-rise 0.45s ease-out 0.95s forwards,
    illu-breathe 3.2s ease-in-out 1.9s infinite;
}
.bar-3 {
  animation:
    illu-rise 0.45s ease-out 1.05s forwards,
    illu-breathe 3.2s ease-in-out 2.3s infinite;
}

/* idle: the equalizer breathes softly while nothing happens */
@keyframes illu-breathe {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(0.78);
  }
}

@keyframes illu-draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes illu-pop {
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes illu-rise {
  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

/* --- hover (parent card): the equalizer plays --- */
:global(.feature-card:hover) .bar {
  opacity: 1;
  animation: illu-play 0.9s ease-in-out infinite;
}
:global(.feature-card:hover) .bar-1 {
  animation-delay: 0s;
}
:global(.feature-card:hover) .bar-2 {
  animation-delay: 0.15s;
}
:global(.feature-card:hover) .bar-3 {
  animation-delay: 0.3s;
}

@keyframes illu-play {
  0%,
  100% {
    transform: scaleY(0.55);
  }
  50% {
    transform: scaleY(1.35);
  }
}

@media (prefers-reduced-motion: reduce) {
  .draw,
  .cup,
  .bar {
    animation: none;
    opacity: 1;
    transform: none;
    stroke-dashoffset: 0;
  }
  :global(.feature-card:hover) .bar {
    animation: none;
    transform: none;
  }
}
</style>
