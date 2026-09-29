<script setup lang="ts">
// L'illustration de la porte « Bibliothèque » : des livres sur une planche,
// dont un penché. Ils montent sur la planche à l'ouverture. Au survol de la
// porte qui les porte (.feature-link), ils se rangent : chacun saute à son
// tour et le livre penché se redresse.
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
    class="illu illu-biblio"
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
    <!-- Le livre penché (accent) est posé sur la planche par son coin
         inférieur gauche, (40, 53), et appuyé par le haut contre le livre
         voisin : 8° suffisent pour que leurs traits se touchent. Il pivote
         autour de ce coin, ici comme dans les animations (.tome-3), pour que
         rien ne passe jamais sous la planche. Pivoté autour du milieu de sa
         base, il penchait dans le vide, un coin enfoncé dans la planche, et
         redressé au survol, il descendait sous elle. -->
    <g class="tome tome-3 accent">
      <rect x="40" y="21" width="9" height="32" rx="1.5" transform="rotate(-8 40 53)" />
      <path d="M40 27h9" stroke-width="2" transform="rotate(-8 40 53)" />
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
  /* Le coin sur lequel le livre repose, en coordonnées du dessin : le même
     pivot que sa pente, pour que le balancement et le redressement le
     gardent posé sur la planche. */
  transform-box: view-box;
  transform-origin: 40px 53px;
  /* Boucle d'attente FINIE (2 balancements puis repos) : les animations
     décoratives infinies gardent le rendu éveillé en permanence, coûteux
     sous Firefox (cf. audit de performance). Le survol relance tout. */
  animation:
    illu-rise 0.5s ease-out 0.65s forwards,
    tome-sway 5s ease-in-out 2s 2;
}

/* idle: the leaning book rocks gently while nothing happens, away from the
   book it leans on */
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

/* --- hover (parent card): the books tidy themselves up ---
   NOTE: the WHOLE selector must live inside :global(), Vue's scoped
   compiler drops anything written after :global(...). */
:global(.feature-link:hover .illu-biblio .tome) {
  opacity: 1;
  transform-box: fill-box;
  transform-origin: bottom center;
}
:global(.feature-link:hover .illu-biblio .tome-1) {
  animation: tome-hop 0.5s ease 0s 1 both;
}
:global(.feature-link:hover .illu-biblio .tome-2) {
  animation: tome-hop 0.5s ease 0.12s 1 both;
}
/* the leaning book springs upright (cancels its baked-in 8° tilt),
   with a small overshoot, and stays straight while hovered. Il se redresse
   sur le coin où il repose (voir .tome-3), pas sur le bas de sa boîte. */
:global(.feature-link:hover .illu-biblio .tome-3) {
  transform-box: view-box;
  transform-origin: 40px 53px;
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
    transform: translateY(-3px) rotate(10.5deg);
  }
  100% {
    transform: rotate(8deg);
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
  :global(.feature-link:hover .illu-biblio .tome) {
    animation: none;
    transform: none;
  }
}
</style>
