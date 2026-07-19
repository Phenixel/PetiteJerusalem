<script setup lang="ts">
// "Profil" hero illustration: a person greeted by little sparks. The person
// rises on load, the sparks pop in then twinkle at idle. On hover of the
// parent .feature-card, the person gives a friendly hop and the sparks burst.
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
    class="illu illu-profil"
  >
    <!-- person -->
    <g class="person">
      <circle cx="32" cy="20" r="8.5" />
      <path d="M15 53c0-10.5 7.6-16.5 17-16.5S49 42.5 49 53" />
    </g>
    <!-- sparks (accent) -->
    <g class="spark spark-1 accent">
      <path d="M52 9v7M48.5 12.5h7" stroke-width="2" />
    </g>
    <g class="spark spark-2 accent">
      <path d="M11 15v5M8.5 17.5h5" stroke-width="2" />
    </g>
    <g class="spark spark-3 accent">
      <path d="M55 30v4M53 32h4" stroke-width="2" />
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

/* --- entrance: the person rises, the sparks pop in one by one --- */
.person {
  opacity: 0;
  transform: translateY(10px);
  animation: illu-rise 0.5s ease-out 0.15s forwards;
}

.spark {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation:
    spark-pop 0.4s ease-out forwards,
    spark-twinkle 4s ease-in-out 2s infinite;
}
.spark-1 {
  animation-delay: 0.55s, 2s;
}
.spark-2 {
  animation-delay: 0.7s, 2.8s;
}
.spark-3 {
  animation-delay: 0.85s, 3.6s;
}

@keyframes illu-rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spark-pop {
  0% {
    opacity: 0;
    transform: scale(0.4);
  }
  70% {
    transform: scale(1.15);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* idle: the sparks twinkle gently in turn */
@keyframes spark-twinkle {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.8);
  }
}

/* --- hover (parent card): friendly hop + spark burst ---
   NOTE: the WHOLE selector must live inside :global() — Vue's scoped
   compiler drops anything written after :global(...). */
:global(.feature-card:hover .illu-profil .person) {
  opacity: 1;
  animation: person-hop 0.55s ease 0s 1 both;
}
:global(.feature-card:hover .illu-profil .spark) {
  opacity: 1;
  transform-box: fill-box;
  transform-origin: center;
}
:global(.feature-card:hover .illu-profil .spark-1) {
  animation: spark-burst 0.5s ease-out 0.1s both;
}
:global(.feature-card:hover .illu-profil .spark-2) {
  animation: spark-burst 0.5s ease-out 0.2s both;
}
:global(.feature-card:hover .illu-profil .spark-3) {
  animation: spark-burst 0.5s ease-out 0.3s both;
}

@keyframes person-hop {
  0%,
  100% {
    transform: translateY(0);
  }
  45% {
    transform: translateY(-4px);
  }
}

@keyframes spark-burst {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.35);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .person,
  .spark {
    animation: none;
    opacity: 1;
    transform: none;
  }
  :global(.feature-card:hover .illu-profil .person),
  :global(.feature-card:hover .illu-profil .spark) {
    animation: none;
    transform: none;
  }
}
</style>
