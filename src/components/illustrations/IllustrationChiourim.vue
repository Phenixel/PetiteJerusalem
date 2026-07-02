<script setup lang="ts">
// "Chiourim" hero illustration: headphones with an equalizer. Draws itself in
// on load. On hover of the parent .feature-card, the headphones nod to the
// beat while the equalizer goes wild and gains two extra bars.
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
    class="illu illu-chiourim"
  >
    <!-- headphones (band + cups) nod together on hover -->
    <g class="phones">
      <!-- headband -->
      <path class="draw" d="M10 40v-6a22 22 0 0 1 44 0v6" />
      <!-- ear cups -->
      <g class="cup cup-l">
        <path d="M10 36h2a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-2a2 2 0 0 1-2-2V38a2 2 0 0 1 2-2z" />
      </g>
      <g class="cup cup-r">
        <path d="M54 36h-2a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h2a2 2 0 0 0 2-2V38a2 2 0 0 0-2-2z" />
      </g>
    </g>
    <!-- equalizer: 3 bars at rest, 2 extra bars join in on hover -->
    <g class="accent" stroke-width="3">
      <path class="bar bar-x bar-4" d="M19 46v-4" />
      <path class="bar bar-1" d="M25 46v-6" />
      <path class="bar bar-2" d="M32 48v-12" />
      <path class="bar bar-3" d="M39 46v-7" />
      <path class="bar bar-x bar-5" d="M45 46v-4" />
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

/* extra bars: invisible at rest, they only join on hover */
.bar-x {
  animation: none;
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

/* --- hover (parent card): the headphones nod, the equalizer goes wild ---
   NOTE: the WHOLE selector must live inside :global() — Vue's scoped
   compiler drops anything written after :global(...). The .illu-chiourim
   root class keeps these global rules from leaking elsewhere. */
:global(.feature-card:hover .illu-chiourim .phones) {
  transform-box: fill-box;
  transform-origin: center 65%;
  animation: phones-nod 0.9s ease-in-out infinite;
}

@keyframes phones-nod {
  0%,
  100% {
    transform: rotate(-2.5deg);
  }
  50% {
    transform: rotate(2.5deg);
  }
}

:global(.feature-card:hover .illu-chiourim .bar) {
  opacity: 1;
  transform-box: fill-box;
  transform-origin: bottom center;
  animation: illu-play 0.45s ease-in-out infinite;
}
:global(.feature-card:hover .illu-chiourim .bar-4) {
  animation-delay: 0s;
}
:global(.feature-card:hover .illu-chiourim .bar-1) {
  animation-delay: 0.09s;
}
:global(.feature-card:hover .illu-chiourim .bar-2) {
  animation-delay: 0.18s;
}
:global(.feature-card:hover .illu-chiourim .bar-3) {
  animation-delay: 0.27s;
}
:global(.feature-card:hover .illu-chiourim .bar-5) {
  animation-delay: 0.36s;
}

@keyframes illu-play {
  0%,
  100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1.6);
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
  .bar-x {
    opacity: 0;
  }
  :global(.feature-card:hover .illu-chiourim .phones),
  :global(.feature-card:hover .illu-chiourim .bar) {
    animation: none;
    transform: none;
  }
}
</style>
